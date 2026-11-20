"use server";

import { db } from "@cap/database";
import { getCurrentUser } from "@cap/database/auth/session";
import { comments, notifications, videos } from "@cap/database/schema";
import { Storage, VideosRepo } from "@cap/web-backend";
import type { Comment, Video } from "@cap/web-domain";
import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { Effect, Option } from "effect";
import { revalidatePath } from "next/cache";
import * as EffectRuntime from "@/lib/server";

export async function deleteComment({
	commentId,
	parentId,
	videoId,
	deleteReplies = false,
}: {
	commentId: Comment.CommentId;
	parentId: Comment.CommentId | null;
	videoId: Video.VideoId;
	deleteReplies?: boolean;
}) {
	const user = await getCurrentUser();

	if (!user) {
		throw new Error("User not authenticated");
	}

	if (!commentId || !videoId) {
		throw new Error("Comment ID and video ID are required");
	}

	try {
		const { deletedIds, mediaKeys } = await db().transaction(async (tx) => {
			const target = and(
				eq(comments.id, commentId),
				eq(comments.videoId, videoId),
			);
			const [existingComment] = await tx
				.select({
					id: comments.id,
					videoId: comments.videoId,
					parentCommentId: comments.parentCommentId,
					ownerId: videos.ownerId,
					mediaKey: comments.mediaKey,
					mediaMeta: comments.mediaMeta,
				})
				.from(comments)
				.innerJoin(videos, eq(comments.videoId, videos.id))
				.where(
					and(
						target,
						or(
							eq(comments.authorId, user.id),
							and(isNull(comments.authorId), eq(videos.ownerId, user.id)),
						),
					),
				)
				.limit(1)
				.for("update");

			if (!existingComment) {
				throw new Error(
					"Comment not found or you don't have permission to delete it",
				);
			}

			const mediaKeys: string[] = [];
			const collectMedia = (
				entry: Pick<typeof comments.$inferSelect, "mediaKey" | "mediaMeta">,
			) => {
				if (entry.mediaKey) mediaKeys.push(entry.mediaKey);
				if (entry.mediaMeta?.thumbnailKey)
					mediaKeys.push(entry.mediaMeta.thumbnailKey);
			};
			collectMedia(existingComment);
			const deletedIds = [commentId];

			if (deleteReplies && !existingComment.parentCommentId) {
				let parents = [commentId];
				while (parents.length > 0) {
					const replies = await tx
						.select({
							id: comments.id,
							authorId: comments.authorId,
							mediaKey: comments.mediaKey,
							mediaMeta: comments.mediaMeta,
						})
						.from(comments)
						.where(
							and(
								eq(comments.videoId, videoId),
								inArray(comments.parentCommentId, parents),
							),
						)
						.for("update");
					if (
						existingComment.ownerId !== user.id &&
						replies.some(({ authorId }) => authorId === null)
					) {
						throw new Error("Only the video owner can delete guest replies.");
					}
					parents = replies.map(({ id }) => id);
					deletedIds.push(...parents);
					for (const reply of replies) collectMedia(reply);
				}
			}
			await tx
				.delete(comments)
				.where(
					deletedIds.length === 1
						? target
						: and(
								eq(comments.videoId, videoId),
								inArray(comments.id, deletedIds),
							),
				);

			if (deletedIds.length > 1) {
				await tx
					.delete(notifications)
					.where(
						and(
							eq(notifications.videoId, videoId),
							eq(notifications.type, "reply"),
							or(
								inArray(
									sql`JSON_UNQUOTE(JSON_EXTRACT(${notifications.data}, '$.comment.id'))`,
									deletedIds.slice(1),
								),
								inArray(
									sql`JSON_UNQUOTE(JSON_EXTRACT(${notifications.data}, '$.parentCommentId'))`,
									deletedIds.slice(1),
								),
							),
						),
					);
			}

			// Delete related notifications
			if (parentId) {
				await tx
					.delete(notifications)
					.where(
						and(
							eq(notifications.type, "reply"),
							sql`JSON_EXTRACT(${notifications.data}, '$.comment.id') = ${commentId}`,
						),
					);
			} else {
				await tx
					.delete(notifications)
					.where(
						and(
							inArray(notifications.type, ["comment", "reaction"]),
							sql`JSON_EXTRACT(${notifications.data}, '$.comment.id') = ${commentId}`,
						),
					);

				await tx
					.delete(notifications)
					.where(
						and(
							eq(notifications.type, "reply"),
							sql`JSON_EXTRACT(${notifications.data}, '$.parentCommentId') = ${commentId}`,
						),
					);
			}
			return { deletedIds, mediaKeys };
		});

		// After the row is gone, best-effort delete of the media objects; a
		// storage failure must not fail the action (the video-delete prefix sweep
		// reclaims any stragglers).
		if (mediaKeys.length > 0) {
			await Effect.gen(function* () {
				const repo = yield* VideosRepo;
				const maybeVideo = yield* repo.getById(videoId);
				if (Option.isNone(maybeVideo)) return;
				const [bucket] = yield* Storage.getAccessForVideo(maybeVideo.value[0]);
				yield* bucket.deleteObjects(mediaKeys.map((Key) => ({ Key })));
			}).pipe(
				// catchAllCause, not catchAll: a defect (missing credential, storage
				// layer panic) must not fail the action either — the row is gone.
				Effect.catchAllCause((cause) =>
					Effect.logError("Failed to delete comment media objects", cause),
				),
				EffectRuntime.runPromise,
			);
		}

		revalidatePath(`/s/${videoId}`);
		return deleteReplies ? { success: true, deletedIds } : { success: true };
	} catch (error) {
		console.error("Error deleting comment:", error);
		throw error;
	}
}
