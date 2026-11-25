import { db } from "@cap/database";
import { comments, notifications, users, videos } from "@cap/database/schema";
import { Storage } from "@cap/web-backend";
import { and, count, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { Effect } from "effect";
import { Hono } from "hono";
import { z } from "zod";
import { runPromise } from "@/lib/server";
import { decodeStorageVideo } from "@/lib/video-storage";
import { jsonExtractString } from "@/utils/sql";
import { zValidator } from "@/utils/zod-validator";
import { withAuth } from "../../utils";

export const app = new Hono().use(withAuth);

const limitQuery = (maximum: number) =>
	zValidator(
		"query",
		z.object({
			limit: z.coerce.number().int().min(1).max(maximum).default(10),
		}),
	);

app.get("/video/recent", limitQuery(30), async (c) => {
	const user = c.get("user");
	const { limit } = c.req.valid("query");
	const recent = await db()
		.select()
		.from(videos)
		.where(eq(videos.ownerId, user.id))
		.orderBy(desc(videos.createdAt), desc(videos.id))
		.limit(limit);
	const ids = recent.map((video) => video.id);
	const [unreadRows, commentRows, notificationRows] = await Promise.all([
		db()
			.select({ total: count() })
			.from(notifications)
			.where(
				and(
					eq(notifications.recipientId, user.id),
					isNull(notifications.readAt),
				),
			),
		ids.length
			? db()
					.select({
						videoId: comments.videoId,
						type: comments.type,
						total: count(),
					})
					.from(comments)
					.where(
						and(
							inArray(comments.videoId, ids),
							inArray(comments.type, ["text", "emoji"]),
						),
					)
					.groupBy(comments.videoId, comments.type)
			: Promise.resolve([]),
		ids.length
			? db()
					.select({
						videoId: notifications.videoId,
						type: notifications.type,
						unread: sql<number>`sum(case when ${notifications.readAt} is null then 1 else 0 end)`,
						total: count(),
					})
					.from(notifications)
					.where(
						and(
							eq(notifications.recipientId, user.id),
							inArray(notifications.videoId, ids),
						),
					)
					.groupBy(notifications.videoId, notifications.type)
			: Promise.resolve([]),
	]);
	const counts = new Map<
		string,
		{ views: number; comments: number; reactions: number; unread: number }
	>(ids.map((id) => [id, { views: 0, comments: 0, reactions: 0, unread: 0 }]));
	for (const row of commentRows) {
		const entry = counts.get(row.videoId);
		if (!entry) continue;
		if (row.type === "text") entry.comments += row.total;
		if (row.type === "emoji") entry.reactions += row.total;
	}
	for (const row of notificationRows) {
		const entry = row.videoId ? counts.get(row.videoId) : undefined;
		if (!entry) continue;
		if (row.type === "view" || row.type === "anon_view")
			entry.views += row.total;
		entry.unread += Number(row.unread);
	}
	const results = await Promise.all(
		recent.map(async (video) => {
			const key = `${video.ownerId}/${video.id}/screenshot/screen-capture.jpg`;
			const thumbnailUrl = await Storage.getAccessForVideo(
				decodeStorageVideo(video),
			)
				.pipe(
					Effect.flatMap(([bucket]) =>
						bucket
							.headObject(key)
							.pipe(
								Effect.flatMap(() =>
									bucket.getSignedObjectUrl(key, { expiresIn: 3600 }),
								),
							),
					),
					Effect.catchAll(() => Effect.succeed(null)),
					runPromise,
				)
				.catch(() => null);
			return {
				id: video.id,
				title: video.name,
				createdAt: video.createdAt,
				duration: video.duration,
				...counts.get(video.id),
				thumbnailUrl,
			};
		}),
	);
	return c.json({ unread: unreadRows[0]?.total ?? 0, videos: results });
});

app.get("/notifications", limitQuery(50), async (c) => {
	const user = c.get("user");
	const { limit } = c.req.valid("query");
	const [unreadRows, rows] = await Promise.all([
		db()
			.select({ total: count() })
			.from(notifications)
			.where(
				and(
					eq(notifications.recipientId, user.id),
					isNull(notifications.readAt),
				),
			),
		db()
			.select({
				id: notifications.id,
				type: notifications.type,
				videoId: notifications.videoId,
				videoTitle: videos.name,
				authorName: users.name,
				data: notifications.data,
				createdAt: notifications.createdAt,
				readAt: notifications.readAt,
			})
			.from(notifications)
			.innerJoin(
				videos,
				and(eq(notifications.videoId, videos.id), eq(videos.ownerId, user.id)),
			)
			.leftJoin(
				users,
				eq(jsonExtractString(notifications.data, "authorId"), users.id),
			)
			.where(eq(notifications.recipientId, user.id))
			.orderBy(desc(notifications.createdAt), desc(notifications.id))
			.limit(limit),
	]);
	return c.json({
		unread: unreadRows[0]?.total ?? 0,
		items: rows.map(({ data, ...row }) => ({
			...row,
			guestName: data.guestName ?? null,
			anonName: data.anonName ?? null,
			comment: data.comment ? { content: data.comment.content } : null,
		})),
	});
});

app.post(
	"/notifications/read",
	zValidator(
		"json",
		z.union([
			z.object({ all: z.literal(true), ids: z.never().optional() }),
			z.object({
				ids: z.array(z.string().min(1)).min(1).max(50),
				all: z.never().optional(),
			}),
		]),
	),
	async (c) => {
		const user = c.get("user");
		const body = c.req.valid("json");
		await db()
			.update(notifications)
			.set({ readAt: new Date() })
			.where(
				and(
					eq(notifications.recipientId, user.id),
					isNull(notifications.readAt),
					"all" in body ? undefined : inArray(notifications.id, body.ids),
				),
			);
		return c.json({ ok: true });
	},
);
