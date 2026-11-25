import { getCurrentUser } from "@cap/database/auth/session";
import { Storage } from "@cap/web-backend";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";

const schema = {
	organizations: { table: "organizations" },
	organizationMembers: { table: "organizationMembers" },
	users: { table: "users" },
	videos: {
		table: "videos",
		id: "videos.id",
		ownerId: "videos.ownerId",
	},
	videoUploads: { table: "videoUploads" },
	authApiKeys: { table: "authApiKeys" },
};

const mockDb = {
	select: vi.fn(),
	from: vi.fn(),
	leftJoin: vi.fn(),
	where: vi.fn(),
	update: vi.fn(),
	set: vi.fn(),
};
const putObject = vi.fn();

vi.mock("@cap/database", () => ({ db: () => mockDb }));
vi.mock("@cap/database/auth/session", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@cap/database/auth/auth-options", () => ({
	getServerSession: vi.fn(),
}));
vi.mock("@cap/database/schema", () => schema);
vi.mock("@cap/database/emails/config", () => ({ sendEmail: vi.fn() }));
vi.mock("@cap/database/emails/first-shareable-link", () => ({
	FirstShareableLink: () => null,
}));
vi.mock("@cap/env", () => ({
	serverEnv: () => ({ WEB_URL: "https://cap.test" }),
	buildEnv: {
		NEXT_PUBLIC_IS_CAP: true,
		NEXT_PUBLIC_WEB_URL: "https://cap.test",
	},
}));
vi.mock("@cap/utils", () => ({ userIsPro: vi.fn(() => true) }));
vi.mock("@cap/web-backend", () => ({
	makeCurrentUserLayer: vi.fn(),
	Videos: class Videos {},
	Storage: {
		getAccessForVideo: vi.fn(),
	},
}));
vi.mock("@/lib/server", () => ({
	runPromise: (value: Effect.Effect<unknown>) => Effect.runPromise(value),
}));
vi.mock("@/lib/video-storage", () => ({
	decodeStorageVideo: vi.fn((video: unknown) => video),
}));
vi.mock("@/lib/live-transcribe", () => ({
	maybeStartLiveTranscription: vi.fn(),
}));
vi.mock("@/lib/google-drive-storage-quota", () => ({
	invalidateGoogleDriveStorageQuotaCache: vi.fn(),
}));
vi.mock("@/lib/server-analytics", () => ({ trackServerEvent: vi.fn() }));
vi.mock("@/lib/desktop-share-url", () => ({
	getDesktopShareUrl: vi.fn(),
}));
vi.mock("drizzle-orm", () => ({
	and: (...clauses: unknown[]) => clauses,
	eq: (field: unknown, value: unknown) => ({ field, value }),
	count: () => "count()",
	lte: () => "lte()",
}));

const mockGetCurrentUser = vi.mocked(getCurrentUser);
const mockStorage = vi.mocked(Storage.getAccessForVideo);
const ownedVideo = {
	id: "video-1",
	ownerId: "user-1",
	duration: 90,
	name: "Original name",
	metadata: {
		sourceName: "camera.mp4",
		customCreatedAt: "2026-11-25",
		summary: "Earlier summary",
		chapters: [{ title: "Earlier chapter", start: 0 }],
	},
};

describe("POST /ai-content", () => {
	let app: typeof import("@/app/api/desktop/[...route]/video")["app"];

	beforeEach(async () => {
		vi.clearAllMocks();
		mockDb.select.mockReturnValue(mockDb);
		mockDb.from.mockReturnValue(mockDb);
		mockDb.leftJoin.mockReturnValue(mockDb);
		mockDb.where.mockImplementation((condition: unknown) => {
			if (Array.isArray(condition)) return Promise.resolve([]);
			return mockDb.update.mock.calls.length > 0
				? Promise.resolve([])
				: Promise.resolve([ownedVideo]);
		});
		mockDb.update.mockReturnValue(mockDb);
		mockDb.set.mockReturnValue(mockDb);
		mockGetCurrentUser.mockResolvedValue({
			id: "user-1",
		} as Awaited<ReturnType<typeof getCurrentUser>>);
		putObject.mockReturnValue(Effect.succeed(undefined));
		mockStorage.mockReturnValue(
			Effect.succeed([{ putObject }, null]) as unknown as ReturnType<
				typeof Storage.getAccessForVideo
			>,
		);
		app = (await import("@/app/api/desktop/[...route]/video")).app;
	});

	function send(body: Record<string, unknown>, authorization?: string) {
		return app.request("https://cap.test/ai-content", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...(authorization ? { Authorization: authorization } : {}),
			},
			body: JSON.stringify({ videoId: "video-1", ...body }),
		});
	}

	it("rejects missing videos without writing", async () => {
		mockDb.where.mockResolvedValueOnce([]);
		const response = await send({ title: "New name" });
		expect(response.status).toBe(404);
		expect(mockDb.update).not.toHaveBeenCalled();
		expect(mockStorage).not.toHaveBeenCalled();
	});

	it("rejects another owner's video without writing", async () => {
		mockDb.where.mockResolvedValueOnce([{ ...ownedVideo, ownerId: "user-2" }]);
		const response = await send({ vtt: "WEBVTT\n\n" });
		expect(response.status).toBe(403);
		expect(mockDb.update).not.toHaveBeenCalled();
		expect(mockStorage).not.toHaveBeenCalled();
	});

	it("uses the desktop API key principal instead of a cookie user", async () => {
		mockGetCurrentUser.mockResolvedValue({
			id: "cookie-user",
		} as Awaited<ReturnType<typeof getCurrentUser>>);
		mockDb.where
			.mockResolvedValueOnce([{ users: { id: "user-1" } }])
			.mockResolvedValueOnce([ownedVideo]);
		const response = await send(
			{ title: "New name" },
			"Bearer 00000000-0000-4000-8000-000000000000",
		);
		expect(response.status).toBe(200);
		expect(mockGetCurrentUser).not.toHaveBeenCalled();
		expect(mockDb.set).toHaveBeenCalledWith(
			expect.objectContaining({ name: "New name" }),
		);
	});

	it("returns the validator's plain wording for invalid chapters", async () => {
		const response = await send({
			chapters: [{ title: "Too late", start: 90 }],
		});
		expect(response.status).toBe(400);
		expect(await response.text()).toBe(
			"Chapter 1 must start before the video ends.",
		);
		expect(mockDb.update).not.toHaveBeenCalled();
	});

	it("keeps unrelated and unsent metadata while updating the name and details", async () => {
		const response = await send({ title: "New name", summary: "New summary" });
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ ok: true });
		expect(mockDb.set).toHaveBeenCalledWith({
			name: "New name",
			metadata: {
				...ownedVideo.metadata,
				aiTitle: "New name",
				summary: "New summary",
				aiGenerationStatus: "COMPLETE",
			},
		});
		expect(mockStorage).not.toHaveBeenCalled();
	});

	it("writes WEBVTT to the owner's canonical key before setting transcription complete", async () => {
		const vtt = "WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nHello";
		const response = await send({ vtt });
		expect(response.status).toBe(200);
		expect(putObject).toHaveBeenCalledExactlyOnceWith(
			"user-1/video-1/transcription.vtt",
			vtt,
			{ contentType: "text/vtt" },
		);
		expect(mockDb.set).toHaveBeenCalledWith({
			transcriptionStatus: "COMPLETE",
		});
		expect(putObject.mock.invocationCallOrder[0]).toBeLessThan(
			mockDb.set.mock.invocationCallOrder[0] ?? 0,
		);
	});

	it("does not mark a failed storage write as transcribed", async () => {
		putObject.mockReturnValue(Effect.fail(new Error("Storage unavailable")));
		vi.spyOn(console, "error").mockImplementation(() => undefined);
		const response = await send({ vtt: "WEBVTT\n\n" });
		expect(response.status).toBe(500);
		expect(mockDb.update).not.toHaveBeenCalled();
	});

	it("rejects invalid or oversized WEBVTT", async () => {
		const invalid = await send({ vtt: "not a transcript" });
		expect(invalid.status).toBe(400);
		const oversized = await send({ vtt: `WEBVTT${"é".repeat(1024 * 1024)}` });
		expect(oversized.status).toBe(400);
		expect(mockStorage).not.toHaveBeenCalled();
	});
});
