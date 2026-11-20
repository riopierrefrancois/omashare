"use server";

import { db } from "@cap/database";
import { getCurrentUser } from "@cap/database/auth/session";
import { nanoId } from "@cap/database/helpers";
import { comments, videos } from "@cap/database/schema";
import { provideOptionalAuth, VideosPolicy } from "@cap/web-backend";
import type { ImageUpload } from "@cap/web-domain";
import { Comment, Policy, type Video } from "@cap/web-domain";
import { eq } from "drizzle-orm";
import { Effect, Exit } from "effect";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getClientIp } from "@/lib/client-ip";
import {
	COMMENT_RATE_LIMITED_MESSAGE,
	isCommentRateLimited,
} from "@/lib/comment-rate-limit";
import { replyParentError } from "@/lib/comment-reply-parent";
import { createNotification } from "@/lib/Notification";
import { isRateLimited, RATE_LIMIT_IDS } from "@/lib/rate-limit";
import * as EffectRuntime from "@/lib/server";
import { isVideoFeedbackDisabled } from "@/lib/video-feedback-rules";

class CommentSubmissionError extends Error {}

export async function postShareComment(data: Parameters<typeof newComment>[0]) {
	try {
		return { comment: await newComment(data) };
	} catch (error) {
		if (error instanceof CommentSubmissionError)
			return { error: error.message };
		throw error;
	}
}

export async function newComment(data: {
	content: string;
	videoId: Video.VideoId;
	type: "text" | "emoji";
	authorImage: ImageUpload.ImageUrl | null;
	parentCommentId: Comment.CommentId;
	timestamp: number | null;
	guestName?: string;
	website?: string;
}) {
	const user = await getCurrentUser();

	let guestName: string | null = null;
	if (!user) {
		if (data.website)
			throw new CommentSubmissionError("User not authenticated");
		if (data.type !== "text")
			throw new CommentSubmissionError("Sign in to react.");
		guestName = typeof data.guestName === "string" ? data.guestName.trim() : "";
		if (!guestName || [...guestName].length > 80)
			throw new CommentSubmissionError("Please add your name.");
	}

	const content = data.content;
	const videoId = data.videoId;
	const type = data.type;
	const parentCommentId = data.parentCommentId;
	const timestamp = data.timestamp;
	const conditionalType = parentCommentId
		? "reply"
		: type === "emoji"
			? "reaction"
			: "comment";

	if (!content || !videoId) {
		throw new CommentSubmissionError("Content and videoId are required");
	}

	const rateLimited = user
		? await isCommentRateLimited(user.id)
		: await isGuestCommentRateLimited();
	if (rateLimited) {
		throw new CommentSubmissionError(COMMENT_RATE_LIMITED_MESSAGE);
	}

	// Authentication alone isn't authorization: without this, any logged-in user could
	// comment on someone else's private video by guessing its id.
	//
	// This also fetches the video row (rather than gating a no-op) because
	// canView returns true for a nonexistent videoId by design, so a bogus id
	// would otherwise reach the insert below.
	const accessExit = await Effect.gen(function* () {
		const videosPolicy = yield* VideosPolicy;
		return yield* Effect.promise(() =>
			db()
				.select({ id: videos.id })
				.from(videos)
				.where(eq(videos.id, videoId))
				.limit(1),
		).pipe(Policy.withPublicPolicy(videosPolicy.canView(videoId)));
	}).pipe(provideOptionalAuth, EffectRuntime.runPromiseExit);

	if (Exit.isFailure(accessExit)) {
		console.error("Video access check failed:", accessExit);
		throw new CommentSubmissionError("Video not found");
	}

	if (accessExit.value.length === 0) {
		throw new CommentSubmissionError("Video not found");
	}

	if (
		await isVideoFeedbackDisabled(
			videoId,
			conditionalType === "reaction" ? "disableReactions" : "disableComments",
		)
	)
		throw new CommentSubmissionError("Feedback is disabled on this video");

	if (parentCommentId) {
		const error = await replyParentError(parentCommentId, videoId);
		if (error) throw new CommentSubmissionError(error);
	}

	const id = Comment.CommentId.make(nanoId());

	const newComment = {
		id: id,
		authorId: user?.id ?? null,
		guestName,
		type: type,
		content: content,
		videoId: videoId,
		timestamp: timestamp ?? null,
		parentCommentId: parentCommentId,
		mediaKey: null,
		mediaDuration: null,
		mediaMeta: null,
		createdAt: new Date(),
		updatedAt: new Date(),
	};

	await db().insert(comments).values(newComment);

	try {
		const details = { videoId, comment: { id, content }, parentCommentId };
		if (user) {
			await createNotification({
				...details,
				type: conditionalType,
				authorId: user.id,
			});
		} else {
			await createNotification({
				...details,
				type: parentCommentId ? "reply" : "comment",
				authorId: null,
				guestName,
			});
		}
	} catch (error) {
		console.error("Failed to create notification:", error);
	}

	// Add author name to the returned data
	const commentWithAuthor = {
		...newComment,
		authorName: user ? user.name : guestName,
		authorImage: user ? data.authorImage : null,
		sending: false,
	};

	revalidatePath(`/s/${videoId}`);

	return commentWithAuthor;
}

async function isGuestCommentRateLimited() {
	const requestHeaders = await headers();
	const ip = getClientIp((name) => requestHeaders.get(name));
	return isRateLimited(RATE_LIMIT_IDS.COMMENT_CREATE, {
		key: `comment:guest:${ip ?? "unknown"}`,
	});
}
