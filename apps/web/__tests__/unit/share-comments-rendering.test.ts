// @vitest-environment jsdom

import {
	act,
	createElement,
	Profiler,
	type ProfilerOnRenderCallback,
	type ReactNode,
	useOptimistic,
	useState,
} from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GuestCommentNameProvider } from "@/app/s/[videoId]/_components/comments/GuestCommentName";
import { ReactionCounts } from "@/app/s/[videoId]/_components/comments/ReactionCounts";
import { ShareComments } from "@/app/s/[videoId]/_components/comments/ShareComments";
import { PlaybackProvider } from "@/app/s/[videoId]/_components/playback/PlaybackContext";
import type { CommentType } from "@/app/s/[videoId]/Share";

const mocks = vi.hoisted(() => ({
	user: { id: "viewer", name: "Viewer", imageUrl: null } as {
		id: string;
		name: string;
		imageUrl: null;
	} | null,
	rowRenders: 0,
	params: new URLSearchParams(),
	post: vi.fn(),
	remove: vi.fn(),
	showError: vi.fn(),
}));

vi.mock("@/actions/videos/get-analytics", () => ({
	getVideoAnalytics: vi.fn(),
}));
vi.mock("@/actions/videos/new-comment", () => ({
	postShareComment: mocks.post,
}));
vi.mock("@/actions/videos/delete-comment", () => ({
	deleteComment: mocks.remove,
}));
vi.mock("@/app/Layout/AuthContext", () => ({
	useCurrentUser: () => mocks.user,
}));
vi.mock("next/navigation", () => ({
	useSearchParams: () => mocks.params,
}));
vi.mock("next/dynamic", () => ({ default: () => () => null }));
vi.mock("sonner", () => ({ toast: { error: mocks.showError } }));
vi.mock("@cap/env", () => ({
	buildEnv: { NEXT_PUBLIC_WEB_URL: "http://localhost:3000" },
}));
vi.mock("@/app/s/[videoId]/_components/media-comment/record-actions", () => ({
	RecordActionButtons: () => null,
}));
vi.mock("@cap/ui", async () => {
	const { Button } = await import(
		"../../../../packages/ui/src/components/Button"
	);
	return { Button };
});
vi.mock("@/components/Tooltip", () => ({
	Tooltip: ({ content, children }: { content: string; children: ReactNode }) =>
		createElement("span", { title: content }, children),
}));
vi.mock("@/components/SignedImageUrl", () => ({
	SignedImageUrl: ({ name }: { name: string }) => {
		if (name.startsWith("Reviewer")) mocks.rowRenders++;
		return createElement("span", { "data-avatar": name });
	},
}));

function comment(id: string, parent = ""): CommentType {
	return {
		id: id as CommentType["id"],
		videoId: "video" as CommentType["videoId"],
		authorId: "viewer" as CommentType["authorId"],
		authorName: "Reviewer",
		authorImage: null,
		content: `Review ${id}\nPlease check this part of the recording.`,
		type: "text",
		parentCommentId: parent as CommentType["parentCommentId"],
		timestamp: 120,
		createdAt: new Date("2026-10-25T12:00:00Z"),
		updatedAt: new Date("2026-10-25T12:00:00Z"),
		mediaKey: null,
		mediaDuration: null,
		mediaMeta: null,
	};
}

function discussion(threads: number) {
	return Array.from({ length: threads }, (_, i) => [
		{
			...comment(`root-${i}`),
			timestamp: i * 12,
			...(i % 5 === 0 ? { type: "emoji" as const, content: "🎉" } : {}),
		},
		comment(`reply-${i}`, `root-${i}`),
		comment(`nested-${i}`, `reply-${i}`),
	]).flat();
}

let root: Root;
let container: HTMLDivElement;
let video: HTMLVideoElement;
let comments: CommentType[];
let durations: number[];
const seek = vi.fn();
const optimistic = vi.fn();
const success = vi.fn();
const setComments = vi.fn();
const onRender: ProfilerOnRenderCallback = (_id, phase, duration) => {
	if (phase !== "mount") durations.push(duration);
};

beforeEach(() => {
	vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
	vi.stubGlobal(
		"IntersectionObserver",
		class {
			observe() {}
			unobserve() {}
			disconnect() {}
		},
	);
	window.localStorage.clear();
	mocks.params = new URLSearchParams();
	mocks.rowRenders = 0;
	mocks.user = { id: "viewer", name: "Viewer", imageUrl: null };
	mocks.post.mockResolvedValue({ comment: comment("saved", "root-1") });
	mocks.remove.mockResolvedValue({ success: true });
	Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
		configurable: true,
		value: vi.fn(),
	});
	comments = discussion(100);
	durations = [];
	container = document.createElement("div");
	video = document.createElement("video");
	video.currentTime = 42;
	document.body.append(video, container);
	root = createRoot(container);
});

afterEach(async () => {
	await act(async () => root.unmount());
	container.remove();
	video.remove();
	vi.unstubAllGlobals();
});

function wrapGuestName(children: ReactNode) {
	const props = { children };
	return createElement(GuestCommentNameProvider, props);
}

async function render(onSeek = seek, disabled = false, isVideoOwner = false) {
	await act(async () => {
		const props = {
			videoRef: { current: video },
			stageRef: { current: null },
			children: createElement(
				Profiler,
				{ id: comments[0]?.videoId ?? "comments", onRender },
				createElement(ShareComments, {
					videoId: "video" as CommentType["videoId"],
					optimisticComments: comments,
					setOptimisticComments: optimistic,
					handleCommentSuccess: success,
					setComments,
					commentsDisabled: disabled,
					isVideoOwner,
					onSeek,
				}),
			),
		};
		root.render(wrapGuestName(createElement(PlaybackProvider, props)));
	});
}

function row(id: string) {
	const element = container.querySelector<HTMLElement>(`#comment-${id}`);
	if (!element) throw new Error(`Missing comment ${id}`);
	return element;
}

async function click(element: HTMLElement | null) {
	if (!element) throw new Error("Missing button");
	await act(async () => element.click());
}

async function reply(id: string) {
	await click(
		Array.from(row(id).querySelectorAll("button")).find(
			(item) => item.textContent === "Reply",
		) ?? null,
	);
}

async function type(input: HTMLTextAreaElement | null, text: string) {
	if (!input) throw new Error("Missing comment editor");
	await act(async () => {
		Object.getOwnPropertyDescriptor(
			HTMLTextAreaElement.prototype,
			"value",
		)?.set?.call(input, text);
		input.dispatchEvent(new Event("input", { bubbles: true }));
	});
}

function button(text: string) {
	return (
		Array.from(container.querySelectorAll("button")).find(
			(element) => element.textContent === text,
		) ?? null
	);
}

async function askDelete(id: string) {
	await click(row(id).querySelector('[aria-label^="Options for this"]'));
	await click(button("Delete"));
	await click(button("Yes, delete"));
}

function contents() {
	return Array.from(
		container.querySelectorAll('[id^="comment-"]'),
		(element) => ({
			id: element.id,
			text: element.querySelector("p.mt-2")?.textContent,
		}),
	);
}

describe("reaction counts", () => {
	it("groups emojis and shows the reactors in the tooltip", async () => {
		const reactions: CommentType[] = [
			{ ...comment("one"), type: "emoji", content: "😂", authorName: "Sam" },
			{ ...comment("two"), type: "emoji", content: "😂", authorName: "Ada" },
			{ ...comment("three"), type: "emoji", content: "👍" },
			comment("text"),
		];
		await act(async () =>
			root.render(createElement(ReactionCounts, { comments: reactions })),
		);
		expect(container.querySelector('[title="Sam, Ada"]')?.textContent).toBe(
			"😂 2",
		);
		expect(container.querySelector("ul")?.textContent).toContain("👍 1");

		await act(async () =>
			root.render(
				createElement(ReactionCounts, { comments: [comment("text")] }),
			),
		);
		expect(container.querySelector("ul")).toBeNull();
	});
});

describe("share comments rendering", () => {
	it("shows the guest name and gives the video owner the delete control", async () => {
		comments = [
			{
				...comment("guest"),
				authorId: null,
				authorName: "Sam",
				guestName: "Sam",
			},
		];

		await render();
		expect(row("guest").textContent).toContain("Sam");
		expect(
			row("guest").querySelector('[aria-label^="Options for this"]'),
		).toBeNull();

		await render(seek, false, true);
		expect(
			row("guest").querySelector('[aria-label^="Options for this"]'),
		).not.toBeNull();
	});

	it("only renders the affected threads when opening and switching replies", async () => {
		await render();
		expect(mocks.rowRenders).toBe(240);
		const initialContents = contents();
		mocks.rowRenders = 0;
		await reply("root-21");
		expect(row("root-21").querySelector("textarea")).not.toBeNull();
		expect(mocks.rowRenders).toBeLessThanOrEqual(3);
		mocks.rowRenders = 0;
		await reply("root-41");
		expect(row("root-21").querySelector("textarea")).toBeNull();
		expect(row("root-41").querySelector("textarea")).not.toBeNull();
		expect(mocks.rowRenders).toBeLessThanOrEqual(6);
		expect(contents()).toEqual(initialContents);
	});

	it("keeps typing and playback updates out of the comment rows", async () => {
		await render();
		await reply("root-21");
		mocks.rowRenders = 0;
		await type(row("root-21").querySelector("textarea"), "A reply draft");
		await type(
			container.querySelector("textarea#share-comment-draft"),
			"A comment draft",
		);
		await act(async () => {
			video.currentTime = 84;
			video.dispatchEvent(new Event("timeupdate"));
		});
		expect(row("root-21").querySelector("textarea")?.value).toBe(
			"A reply draft",
		);
		expect(mocks.rowRenders).toBe(0);
	});

	it("skips unchanged rows on parent renders and refreshes changed content and permissions", async () => {
		comments = discussion(2);
		await render();
		mocks.rowRenders = 0;
		await render();
		expect(mocks.rowRenders).toBe(0);
		comments = comments.map((entry) =>
			entry.id === "reply-1" ? { ...entry, content: "Updated reply" } : entry,
		);
		await render();
		expect(row("reply-1").textContent).toContain("Updated reply");
		mocks.user = { id: "other-viewer", name: "Another viewer", imageUrl: null };
		await render();
		expect(
			container.querySelector('[aria-label^="Options for this"]'),
		).toBeNull();
		await reply("root-1");
		await type(
			row("root-1").querySelector("textarea"),
			"Reply as another viewer",
		);
		await click(button("Send"));
		expect(optimistic).toHaveBeenCalledWith(
			expect.objectContaining({
				authorId: "other-viewer",
				parentCommentId: "root-1",
			}),
		);
	});

	it("shows newest comments first and reveals older replies in order", async () => {
		comments = [
			comment("older"),
			{ ...comment("newer"), createdAt: new Date("2026-10-26") },
			{ ...comment("reaction"), type: "emoji", content: "🎉" },
			comment("one", "newer"),
			{ ...comment("two", "one"), createdAt: new Date("2026-10-26") },
			{ ...comment("three", "newer"), createdAt: new Date("2026-10-27") },
		];
		await render();
		expect(contents().map(({ id }) => id)).toEqual([
			"comment-newer",
			"comment-two",
			"comment-three",
			"comment-older",
		]);
		await click(button("Show 1 earlier reply"));
		expect(contents().map(({ id }) => id)).toEqual([
			"comment-newer",
			"comment-one",
			"comment-two",
			"comment-three",
			"comment-older",
		]);
		await click(button("Show fewer replies"));
		expect(container.querySelector("#comment-one")).toBeNull();
		expect(row("older").querySelector("p.mt-2")?.className).toContain(
			"whitespace-pre-wrap",
		);
	});

	it("uses the current reply target and callbacks when submitting or cancelling", async () => {
		comments = discussion(2);
		await render();
		await reply("root-1");
		await type(row("root-1").querySelector("textarea"), "Discarded");
		await click(button("Cancel"));
		expect(mocks.post).not.toHaveBeenCalled();
		await reply("root-1");
		await type(row("root-1").querySelector("textarea"), "Reply to the root");
		await click(button("Send"));
		expect(mocks.post).toHaveBeenCalledWith(
			expect.objectContaining({
				content: "Reply to the root",
				parentCommentId: "root-1",
				timestamp: 42,
			}),
		);
		expect(optimistic).toHaveBeenCalledWith(
			expect.objectContaining({
				content: "Reply to the root",
				parentCommentId: "root-1",
				sending: true,
			}),
		);
		expect(success).toHaveBeenCalledWith(
			expect.objectContaining(comment("saved", "root-1")),
		);
		expect(row("root-1").querySelector("textarea")).toBeNull();
		const updatedSeek = vi.fn();
		await render(updatedSeek);
		await click(
			Array.from(row("root-1").querySelectorAll("button")).find(
				(item) => item.getAttribute("aria-label") === "Seek to 0:12",
			) ?? null,
		);
		expect(updatedSeek).toHaveBeenCalledWith(12);
	});

	it("refreshes replies after optimistic additions, settlement and deletion", async () => {
		comments = discussion(2);
		await render();
		const pending = { ...comment("pending", "root-1"), sending: true };
		comments = [...comments, pending];
		await render();
		const mounted = row("pending");
		expect(mounted.className).toContain("opacity-60");
		comments = comments.map((entry) =>
			entry === pending
				? {
						...entry,
						id: "saved" as CommentType["id"],
						clientKey: "pending",
						sending: false,
					}
				: entry,
		);
		await render();
		expect(row("saved")).toBe(mounted);
		expect(row("saved").className).not.toContain("opacity-60");

		await askDelete("saved");
		expect(mocks.remove).toHaveBeenCalledWith({
			commentId: "saved",
			parentId: "root-1",
			videoId: "video",
			deleteReplies: false,
		});
		comments = comments.filter((entry) => entry.id !== "saved");
		await render();
		expect(container.querySelector("#comment-saved")).toBeNull();
	});

	it("shows the seek chip only on the root comment", async () => {
		comments = [
			{ ...comment("root"), timestamp: 42 },
			{ ...comment("first-reply", "root"), timestamp: 0 },
			{ ...comment("second-reply", "root"), timestamp: 18 },
		];
		await render();

		await click(button("▶ 0:42"));
		expect(seek).toHaveBeenCalledWith(42);
		expect(button("▶ 0:00")).toBeNull();
		expect(button("▶ 0:18")).toBeNull();
		expect(row("first-reply").querySelector("time")).not.toBeNull();
	});

	it("asks to delete the root with its reply count and lets the viewer keep it", async () => {
		comments = [
			comment("root"),
			comment("one", "root"),
			comment("two", "root"),
		];
		await render();
		await click(
			row("root").querySelector('[aria-label="Options for this comment"]'),
		);
		await click(button("Delete"));
		expect(row("root").textContent).toContain(
			"Delete this comment and its 2 replies? It can't be undone.",
		);
		await click(button("Keep"));
		expect(button("Yes, delete")).toBeNull();
		expect(mocks.remove).not.toHaveBeenCalled();
	});

	it("offers delete only once your comment is saved, and says so when deleting fails", async () => {
		comments = [
			...discussion(2),
			{ ...comment("pending", "root-1"), sending: true },
		];
		await render();
		expect(
			row("pending").querySelector('[aria-label^="Options for this"]'),
		).toBeNull();

		mocks.remove.mockRejectedValueOnce(new Error("Offline"));
		mocks.showError.mockReset();
		setComments.mockReset();
		vi.spyOn(console, "error").mockImplementation(() => {});

		await click(button("Show 1 earlier reply"));
		await askDelete("reply-1");

		expect(mocks.remove).toHaveBeenCalledWith({
			commentId: "reply-1",
			parentId: "root-1",
			videoId: "video",
			deleteReplies: false,
		});
		expect(mocks.showError).toHaveBeenCalledExactlyOnceWith(
			"Couldn't delete the comment. Please try again.",
		);
		expect(setComments).not.toHaveBeenCalled();
	});

	it.each(["comment", "reply"] as const)(
		"keeps a failed %s draft for retry and clears it only after saving",
		async (kind) => {
			comments = discussion(2);
			const firstSave = Promise.withResolvers<{ comment: CommentType }>();
			mocks.post.mockReturnValueOnce(firstSave.promise);
			vi.spyOn(console, "error").mockImplementation(() => {});
			await render();
			if (kind === "reply") await reply("root-1");
			const input = container.querySelector("textarea");
			if (!input) throw new Error("Missing comment editor");
			const label = "Send";
			await type(input, "Please check the last frame.");
			await click(button(label));
			expect(mocks.post).toHaveBeenCalledOnce();
			expect(input.value).toBe("Please check the last frame.");
			expect(input.disabled).toBe(false);
			expect(input.readOnly).toBe(true);
			await act(async () => {
				input.dispatchEvent(
					new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
				);
			});
			expect(mocks.post).toHaveBeenCalledOnce();
			await act(async () => {
				firstSave.reject(new Error("Offline"));
			});
			expect(input.isConnected).toBe(true);
			expect(input.value).toBe("Please check the last frame.");
			expect(input.readOnly).toBe(false);
			expect(mocks.showError).toHaveBeenCalledWith(
				"Couldn't post your comment. Please try again.",
			);
			expect(success).not.toHaveBeenCalled();
			const retry = Promise.withResolvers<{ comment: CommentType }>();
			mocks.post.mockReturnValueOnce(retry.promise);
			await click(button(label));
			expect(mocks.post).toHaveBeenLastCalledWith(
				expect.objectContaining({
					content: "Please check the last frame.",
					parentCommentId: kind === "reply" ? "root-1" : "",
					timestamp: 42,
				}),
			);
			const saved = comment("saved", kind === "reply" ? "root-1" : "");
			await act(async () => retry.resolve({ comment: saved }));
			expect(success).toHaveBeenCalledExactlyOnceWith(
				expect.objectContaining(saved),
			);
			if (kind === "comment") expect(input.value).toBe("");
			else expect(input.isConnected).toBe(false);
		},
	);

	it("keeps the bottom comment field focused through an Enter submission", async () => {
		comments = [];
		const save = Promise.withResolvers<{ comment: CommentType }>();
		mocks.post.mockReturnValueOnce(save.promise);
		await render();
		const input = container.querySelector("textarea");
		if (!input) throw new Error("Missing comment editor");
		await act(async () => input.focus());
		await type(input, "Keep typing here");

		await act(async () => {
			input.dispatchEvent(
				new KeyboardEvent("keydown", {
					key: "Enter",
					bubbles: true,
					cancelable: true,
				}),
			);
		});
		expect(document.activeElement).toBe(input);
		expect(input.disabled).toBe(false);
		expect(input.readOnly).toBe(true);
		expect(input.getAttribute("aria-busy")).toBe("true");
		expect(button("Send")?.disabled).toBe(true);

		await act(async () => save.resolve({ comment: comment("saved") }));
		expect(document.activeElement).toBe(input);
		expect(input.value).toBe("");
		expect(input.readOnly).toBe(false);
	});

	it("offers Reply only on the root and restores focus after sending", async () => {
		comments = [comment("root"), comment("existing-reply", "root")];
		mocks.post.mockResolvedValue({ comment: comment("saved", "root") });
		await render();
		expect(row("existing-reply").textContent).not.toMatch(/\bReply\b/);
		const trigger = Array.from(row("root").querySelectorAll("button")).find(
			(item) => item.textContent === "Reply",
		);
		await click(trigger ?? null);
		const input = row("root").querySelector("textarea");
		await type(input, "Thanks!");
		await click(button("Send"));
		expect(input?.isConnected).toBe(false);
		expect(document.activeElement).toBe(trigger);
	});

	it.each(["success", "failure"])(
		"keeps the optimistic comment visible until save %s",
		async (outcome) => {
			const save = Promise.withResolvers<{ comment: CommentType }>();
			mocks.post.mockReturnValueOnce(save.promise);
			vi.spyOn(console, "error").mockImplementation(() => {});
			function LiveComments() {
				const [saved, setSaved] = useState([comment("existing")]);
				const [pending, addPending] = useOptimistic(
					saved,
					(state, entry: CommentType) =>
						state.some((saved) => saved.clientKey === entry.id)
							? state
							: [...state, entry],
				);
				return createElement(ShareComments, {
					videoId: "video" as CommentType["videoId"],
					optimisticComments: pending,
					setOptimisticComments: addPending,
					handleCommentSuccess: (entry) => setSaved((prev) => [...prev, entry]),
					setComments: setSaved,
					commentsDisabled: false,
				});
			}
			const playbackProps = {
				videoRef: { current: video },
				stageRef: { current: null },
				children: createElement(LiveComments),
			};
			await act(async () =>
				root.render(
					wrapGuestName(createElement(PlaybackProvider, playbackProps)),
				),
			);
			const input = container.querySelector("textarea");
			if (!input) throw new Error("Missing comment editor");
			await type(input, "Unsent draft");
			await click(button("Send"));
			expect(contents().map((entry) => entry.text)).toContain("Unsent draft");
			if (outcome === "success") {
				await act(async () =>
					save.resolve({
						comment: {
							...comment("saved"),
							content: "Unsent draft",
							createdAt: new Date(),
						},
					}),
				);
				expect(contents()).toEqual([
					{ id: "comment-saved", text: "Unsent draft" },
					{ id: "comment-existing", text: comment("existing").content },
				]);
				expect(input.value).toBe("");
				expect(row("saved").className).toContain("ring-2");
				expect(row("saved").scrollIntoView).toHaveBeenCalled();
			} else {
				await act(async () => save.reject(new Error("Offline")));
				expect(contents().map((entry) => entry.text)).not.toContain(
					"Unsent draft",
				);
				expect(input.value).toBe("Unsent draft");
			}
		},
	);

	it("keeps failed replies open and handles empty and disabled discussions", async () => {
		comments = discussion(2);
		mocks.post.mockRejectedValue(new Error("Offline"));
		vi.spyOn(console, "error").mockImplementation(() => {});
		await render();
		await reply("root-1");
		await type(row("root-1").querySelector("textarea"), "Unsent");
		await click(button("Send"));
		expect(row("root-1").querySelector("textarea")).not.toBeNull();
		expect(success).not.toHaveBeenCalled();
		comments = [];
		await render();
		expect(contents()).toEqual([]);
		await render(seek, true);
		expect(container.querySelector("textarea")).toBeNull();
	});

	it("remembers a guest name for replies and future visits", async () => {
		mocks.user = null;
		comments = [comment("root"), comment("existing-reply", "root")];
		mocks.post.mockResolvedValue({
			comment: {
				...comment("guest-saved", "root"),
				authorId: null,
				authorName: "Sam",
			},
		});
		await render();
		await reply("root");
		const card = row("root");
		const text = card.querySelector("textarea");
		const name = card.querySelector<HTMLInputElement>(
			'input[autocomplete="name"]',
		);
		if (!name) throw new Error("Missing name field");
		expect(card.textContent).toContain("Replying to Reviewer");
		await act(async () => {
			const set = Object.getOwnPropertyDescriptor(
				HTMLInputElement.prototype,
				"value",
			)?.set;
			if (!set) throw new Error("Missing input setter");
			set.call(name, "  Sam  ");
			name.dispatchEvent(new Event("input", { bubbles: true }));
		});
		await type(text, "Thanks!");
		await click(button("Send"));
		expect(mocks.post).toHaveBeenCalledWith(
			expect.objectContaining({
				guestName: "Sam",
				website: "",
				parentCommentId: "root",
			}),
		);
		expect(window.localStorage.getItem("omashare.guestName")).toBe("Sam");
		expect(container.textContent).toContain("Commenting as Sam");
		await act(async () => root.unmount());
		root = createRoot(container);
		await render();
		expect(container.textContent).toContain("Commenting as Sam");
		await click(button("Change"));
		expect(
			container.querySelector('input[autocomplete="name"]'),
		).not.toBeNull();
	});

	it("uses the current playhead and lets guests send without a timestamp", async () => {
		mocks.user = null;
		window.localStorage.setItem("omashare.guestName", "Sam");
		comments = [];
		await render();
		const field = container.querySelector("textarea");
		expect(field?.placeholder).toBe("Write a comment at 0:42…");
		await act(async () => {
			video.currentTime = 73;
			video.dispatchEvent(new Event("timeupdate"));
		});
		expect(field?.placeholder).toBe("Write a comment at 1:13…");
		await click(button("at 1:13 ✕"));
		await type(field, "Untimed");
		mocks.post.mockResolvedValueOnce({
			error: "Feedback is disabled on this video",
		});
		await click(button("Send"));
		expect(mocks.post).toHaveBeenCalledWith(
			expect.objectContaining({ timestamp: null, guestName: "Sam" }),
		);
		expect(mocks.showError).toHaveBeenCalledWith(
			"Feedback is disabled on this video",
		);
		expect(field?.value).toBe("Untimed");
	});

	it.skipIf(!process.env.CAP_COMMENTS_BENCH)(
		"profiles 100 threads with 300 comments",
		async () => {
			await render();
			const switching: number[] = [];
			const elapsed: number[] = [];
			const typing: number[] = [];
			let switchingRowRenders = 0;
			for (let i = 0; i < 40; i++) {
				durations = [];
				mocks.rowRenders = 0;
				const start = performance.now();
				await reply(i % 2 ? "root-21" : "root-41");
				if (i >= 10) {
					switching.push(
						durations.reduce((sum, duration) => sum + duration, 0),
					);
					elapsed.push(performance.now() - start);
					switchingRowRenders += mocks.rowRenders;
				}
			}
			mocks.rowRenders = 0;
			for (let i = 0; i < 40; i++) {
				durations = [];
				await type(
					row("root-21").querySelector("textarea"),
					`Reply draft ${i}`,
				);
				if (i >= 10)
					typing.push(durations.reduce((sum, duration) => sum + duration, 0));
			}
			expect(switching).toHaveLength(30);
			expect(typing).toHaveLength(30);
			const median = (values: number[]) =>
				[...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
			console.log(
				JSON.stringify({
					comments: 300,
					samples: 30,
					switchingMedianMs: median(switching),
					switchingElapsedMedianMs: median(elapsed),
					switchingRowRenders,
					typingMedianMs: median(typing),
					typingRowRenders: mocks.rowRenders,
				}),
			);
		},
		120000,
	);
});
