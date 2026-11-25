import { getCurrentUser } from "@cap/database/auth/session";
import { Storage } from "@cap/web-backend";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";

const schema = {
	authApiKeys: { id: "authApiKeys.id", userId: "authApiKeys.userId" },
	comments: {
		videoId: "comments.videoId",
		type: "comments.type",
	},
	notifications: {
		id: "notifications.id",
		recipientId: "notifications.recipientId",
		videoId: "notifications.videoId",
		readAt: "notifications.readAt",
		createdAt: "notifications.createdAt",
		type: "notifications.type",
		data: "notifications.data",
	},
	users: { id: "users.id", name: "users.name" },
	videos: {
		id: "videos.id",
		name: "videos.name",
		ownerId: "videos.ownerId",
		createdAt: "videos.createdAt",
	},
};

type Condition =
	| { field: unknown; value: unknown }
	| { and: Condition[] }
	| { in: [unknown, unknown[]] }
	| { null: unknown }
	| undefined;

type Query = {
	table: unknown;
	projection: Record<string, unknown> | undefined;
	condition: Condition;
	limitValue?: number;
	groupFields: unknown[];
	from: (table: unknown) => Query;
	where: (condition: Condition) => Query | Promise<Record<string, unknown>[]>;
	innerJoin: (table: unknown, condition: Condition) => Query;
	leftJoin: (table: unknown, condition: Condition) => Query;
	orderBy: (...fields: unknown[]) => Query;
	groupBy: (...fields: unknown[]) => Promise<Record<string, unknown>[]>;
	limit: (value: number) => Promise<Record<string, unknown>[]>;
};

const queries: Query[] = [];
const results = {
	videos: [] as Record<string, unknown>[],
	comments: [] as Record<string, unknown>[],
	videoNotifications: [] as Record<string, unknown>[],
	notifications: [] as Record<string, unknown>[],
	unread: 0,
};
const update = {
	set: vi.fn(),
	where: vi.fn(),
};
const mockDb = {
	select: vi.fn(),
	update: vi.fn(),
};
const headObject = vi.fn();
const getSignedObjectUrl = vi.fn();

vi.mock("@cap/database", () => ({ db: () => mockDb }));
vi.mock("@cap/database/auth/session", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@cap/database/schema", () => schema);
vi.mock("@cap/env", () => ({
	buildEnv: { NEXT_PUBLIC_WEB_URL: "https://cap.test" },
}));
vi.mock("@cap/web-backend", () => ({
	Storage: { getAccessForVideo: vi.fn() },
}));
vi.mock("@/lib/server", () => ({
	runPromise: (value: Effect.Effect<unknown>) => Effect.runPromise(value),
}));
vi.mock("@/lib/video-storage", () => ({
	decodeStorageVideo: (video: unknown) => video,
}));
vi.mock("drizzle-orm", () => ({
	and: (...conditions: Condition[]) => ({
		and: conditions.filter((condition) => condition !== undefined),
	}),
	eq: (field: unknown, value: unknown) => ({ field, value }),
	inArray: (field: unknown, values: unknown[]) => ({ in: [field, values] }),
	isNull: (field: unknown) => ({ null: field }),
	desc: (field: unknown) => ({ desc: field }),
	count: () => "count()",
	sql: Object.assign(() => "sql", { raw: () => "sql" }),
}));
vi.mock("@/utils/sql", () => ({
	jsonExtractString: () => "authorId",
}));

const mockGetCurrentUser = vi.mocked(getCurrentUser);
const mockStorage = vi.mocked(Storage.getAccessForVideo);
const video = {
	id: "video-1",
	ownerId: "user-1",
	name: "My video",
	duration: 90,
	createdAt: new Date("2026-11-25T12:00:00Z"),
};

function hasCondition(
	condition: Condition,
	field: unknown,
	value: unknown,
): boolean {
	if (!condition) return false;
	if ("and" in condition)
		return condition.and.some((part) => hasCondition(part, field, value));
	return (
		"field" in condition &&
		condition.field === field &&
		condition.value === value
	);
}

function queryResult(query: Query) {
	if (query.table === schema.videos) return results.videos;
	if (query.table === schema.comments) return results.comments;
	if (query.table === schema.users) return [{ users: { id: "user-1" } }];
	if (
		Object.keys(query.projection ?? {}).length === 1 &&
		query.projection?.total === "count()"
	)
		return [{ total: results.unread }];
	if (query.projection?.views !== undefined) return results.videoNotifications;
	if (query.projection?.unread !== undefined) return results.videoNotifications;
	return results.notifications;
}

describe("desktop share activity", () => {
	let app: typeof import("@/app/api/desktop/[...route]/activity")["app"];

	beforeEach(async () => {
		vi.clearAllMocks();
		queries.length = 0;
		results.videos = [video];
		results.comments = [];
		results.videoNotifications = [];
		results.notifications = [];
		results.unread = 0;
		mockGetCurrentUser.mockResolvedValue({
			id: "user-1",
		} as Awaited<ReturnType<typeof getCurrentUser>>);
		mockDb.select.mockImplementation((projection?: Record<string, unknown>) => {
			const query: Query = {
				table: undefined,
				projection,
				condition: undefined,
				groupFields: [],
				from(table) {
					this.table = table;
					queries.push(this);
					return this;
				},
				where(condition) {
					this.condition = condition;
					if (
						this.table === schema.users ||
						(this.table === schema.notifications &&
							Object.keys(this.projection ?? {}).length === 1 &&
							this.projection?.total === "count()")
					)
						return Promise.resolve(queryResult(this));
					return this;
				},
				innerJoin() {
					return this;
				},
				leftJoin() {
					return this;
				},
				orderBy() {
					return this;
				},
				groupBy(...fields) {
					this.groupFields = fields;
					return Promise.resolve(queryResult(this));
				},
				limit(value) {
					this.limitValue = value;
					return Promise.resolve(queryResult(this));
				},
			};
			return query;
		});
		mockDb.update.mockReturnValue(update);
		update.set.mockReturnValue(update);
		update.where.mockResolvedValue([]);
		headObject.mockReturnValue(Effect.succeed({}));
		getSignedObjectUrl.mockReturnValue(
			Effect.succeed("https://storage.test/signed"),
		);
		mockStorage.mockReturnValue(
			Effect.succeed([
				{ headObject, getSignedObjectUrl },
				null,
			]) as unknown as ReturnType<typeof Storage.getAccessForVideo>,
		);
		app = (await import("@/app/api/desktop/[...route]/activity")).app;
	});

	it("lists only owned videos, counts text/emoji and both view types, and signs existing thumbnails", async () => {
		results.unread = 4;
		results.comments = [
			{ videoId: video.id, type: "text", total: 2 },
			{ videoId: video.id, type: "emoji", total: 3 },
		];
		results.videoNotifications = [
			{ videoId: video.id, type: "view", total: 2, unread: 1 },
			{ videoId: video.id, type: "anon_view", total: 1, unread: 1 },
			{ videoId: video.id, type: "comment", total: 1, unread: 1 },
		];
		const response = await app.request("https://cap.test/video/recent?limit=8");
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			unread: 4,
			videos: [
				{
					id: video.id,
					title: video.name,
					createdAt: video.createdAt.toISOString(),
					duration: 90,
					views: 3,
					comments: 2,
					reactions: 3,
					unread: 3,
					thumbnailUrl: "https://storage.test/signed",
				},
			],
		});
		expect(
			queries.some(
				(query) =>
					query.table === schema.videos &&
					hasCondition(query.condition, schema.videos.ownerId, "user-1") &&
					query.limitValue === 8,
			),
		).toBe(true);
		expect(
			queries.some(
				(query) =>
					query.table === schema.notifications &&
					hasCondition(
						query.condition,
						schema.notifications.recipientId,
						"user-1",
					),
			),
		).toBe(true);
		expect(headObject).toHaveBeenCalledWith(
			"user-1/video-1/screenshot/screen-capture.jpg",
		);
		expect(getSignedObjectUrl).toHaveBeenCalledWith(
			"user-1/video-1/screenshot/screen-capture.jpg",
			{ expiresIn: 3600 },
		);
	});

	it("does not sign a thumbnail when the object is missing", async () => {
		headObject.mockReturnValue(Effect.fail(new Error("not found")));
		const response = await app.request("https://cap.test/video/recent");
		expect((await response.json()).videos[0].thumbnailUrl).toBeNull();
		expect(getSignedObjectUrl).not.toHaveBeenCalled();
	});

	it("lists notifications for the recipient and only joins their own videos", async () => {
		results.unread = 2;
		results.notifications = [
			{
				id: "notice-1",
				type: "comment",
				videoId: video.id,
				videoTitle: video.name,
				authorName: "Sam",
				data: {
					guestName: null,
					comment: { id: "comment-1", content: "Nice!" },
				},
				createdAt: video.createdAt,
				readAt: null,
			},
		];
		const response = await app.request(
			"https://cap.test/notifications?limit=5",
		);
		expect(await response.json()).toEqual({
			unread: 2,
			items: [
				{
					id: "notice-1",
					type: "comment",
					videoId: video.id,
					videoTitle: video.name,
					authorName: "Sam",
					guestName: null,
					anonName: null,
					comment: { content: "Nice!" },
					createdAt: video.createdAt.toISOString(),
					readAt: null,
				},
			],
		});
		expect(
			queries.some(
				(query) =>
					query.projection?.authorName === schema.users.name &&
					hasCondition(
						query.condition,
						schema.notifications.recipientId,
						"user-1",
					) &&
					query.limitValue === 5,
			),
		).toBe(true);
	});

	it("only marks the authenticated recipient's selected rows or all their unread rows", async () => {
		const selected = await app.request("https://cap.test/notifications/read", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ ids: ["notice-1", "another-user-notice"] }),
		});
		expect(await selected.json()).toEqual({ ok: true });
		expect(
			hasCondition(
				update.where.mock.calls[0]?.[0],
				schema.notifications.recipientId,
				"user-1",
			),
		).toBe(true);
		expect(update.where.mock.calls[0]?.[0]).toEqual({
			and: [
				{ field: schema.notifications.recipientId, value: "user-1" },
				{ null: schema.notifications.readAt },
				{ in: [schema.notifications.id, ["notice-1", "another-user-notice"]] },
			],
		});
		const all = await app.request("https://cap.test/notifications/read", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ all: true }),
		});
		expect(all.status).toBe(200);
		expect(update.where.mock.calls[1]?.[0]).toEqual({
			and: [
				{ field: schema.notifications.recipientId, value: "user-1" },
				{ null: schema.notifications.readAt },
			],
		});
	});

	it("rejects out-of-range limits and invalid read requests before accessing data", async () => {
		for (const path of [
			"/video/recent?limit=0",
			"/video/recent?limit=31",
			"/video/recent?limit=2.5",
			"/notifications?limit=51",
		]) {
			expect((await app.request(`https://cap.test${path}`)).status).toBe(400);
		}
		for (const body of [{}, { ids: [] }, { all: true, ids: ["notice-1"] }]) {
			const response = await app.request(
				"https://cap.test/notifications/read",
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(body),
				},
			);
			expect(response.status).toBe(400);
		}
		expect(queries).toHaveLength(0);
		expect(mockDb.update).not.toHaveBeenCalled();
	});

	it("uses the desktop key principal rather than the cookie user", async () => {
		mockGetCurrentUser.mockResolvedValue({
			id: "cookie-user",
		} as Awaited<ReturnType<typeof getCurrentUser>>);
		const response = await app.request("https://cap.test/video/recent", {
			headers: { Authorization: "Bearer 00000000-0000-4000-8000-000000000000" },
		});
		expect(response.status).toBe(200);
		expect(mockGetCurrentUser).not.toHaveBeenCalled();
		expect(
			queries.some(
				(query) =>
					query.table === schema.videos &&
					hasCondition(query.condition, schema.videos.ownerId, "user-1"),
			),
		).toBe(true);
	});
});
