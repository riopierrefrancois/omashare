// @vitest-environment jsdom

import type { Comment, Organisation, User, Video } from "@cap/web-domain";
import type { ComponentProps } from "react";
import { act, createElement } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { newComment, postShareComment } from "@/actions/videos/new-comment";
import { GuestCommentNameProvider } from "@/app/s/[videoId]/_components/comments/GuestCommentName";
import { PlaybackProvider } from "@/app/s/[videoId]/_components/playback/PlaybackContext";
import { Toolbar } from "@/app/s/[videoId]/_components/Toolbar";
import CommentInput from "@/app/s/[videoId]/_components/tabs/Activity/CommentInput";
import { TimelineComposer } from "@/app/s/[videoId]/_components/timeline/TimelineComposer";
import {
	TimelineProvider,
	useTimelineActions,
} from "@/app/s/[videoId]/_components/timeline/TimelineProvider";
import TimelineView from "@/app/s/[videoId]/_components/timeline/TimelineView";

vi.mock("@/actions/videos/new-comment", () => ({
	newComment: vi.fn(),
	postShareComment: vi.fn(),
}));
const showError = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({ toast: { error: showError } }));
const auth = vi.hoisted(() => ({
	user: { id: "viewer", name: "Viewer", imageUrl: null } as {
		id: string;
		name: string;
		imageUrl: null;
	} | null,
}));
vi.mock("@/app/Layout/AuthContext", () => ({
	useCurrentUser: () => auth.user,
}));
vi.mock("hooks/use-transcript", () => ({
	useTranscript: () => ({ data: undefined }),
}));
vi.mock("next/dynamic", () => ({ default: () => () => null }));
vi.mock("@/app/s/[videoId]/_components/AuthOverlayLazy", () => ({
	AuthOverlay: () => null,
}));
vi.mock("@/app/s/[videoId]/_components/media-comment/record-actions", () => ({
	RecordActionButtons: () => null,
}));
vi.mock("@/app/s/[videoId]/_components/timeline/TimelineBranch", () => ({
	MicGlyph: () => null,
}));
vi.mock("@cap/ui", async () => {
	const { Button } = await import(
		"../../../../packages/ui/src/components/Button"
	);
	const dropdown = await import(
		"../../../../packages/ui/src/components/Dropdown"
	);
	return { Button, ...dropdown };
});

const videoId = "video" as Video.VideoId;
const video = {
	id: videoId,
	orgId: "organization" as Organisation.OrganisationId,
	owner: { id: "owner" as User.UserId, isPro: false },
	name: "Test screenshot",
	bucket: null,
	storageIntegrationId: null,
	duration: null,
	width: null,
	height: null,
	fps: null,
	metadata: null,
	public: true,
	settings: null,
	transcriptionStatus: null,
	source: { type: "local" },
	folderId: null,
	createdAt: new Date(),
	effectiveCreatedAt: null,
	updatedAt: new Date(),
	password: null,
	xStreamInfo: null,
	firstViewEmailSentAt: null,
	isScreenshot: true,
	awsRegion: null,
	awsBucket: null,
	videoStartTime: null,
	audioStartTime: null,
	jobId: null,
	jobStatus: null,
	skipProcessing: false,
} satisfies ComponentProps<typeof Toolbar>["data"];
let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
	vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
	window.localStorage.clear();
	auth.user = { id: "viewer", name: "Viewer", imageUrl: null };
	vi.mocked(postShareComment)
		.mockReset()
		.mockImplementation(async (data) => ({
			comment: await newComment(data),
		}));
	vi.mocked(newComment)
		.mockReset()
		.mockImplementation(async (data) => ({
			...data,
			id: "comment" as Comment.CommentId,
			authorId: "viewer" as User.UserId,
			guestName: null,
			authorName: "Viewer",
			createdAt: new Date(),
			updatedAt: new Date(),
			mediaKey: null,
			mediaDuration: null,
			mediaMeta: null,
			sending: false,
		}));
	container = document.createElement("div");
	document.body.append(container);
	root = createRoot(container);
});

afterEach(async () => {
	await act(async () => {
		root.unmount();
	});
	container.remove();
	vi.unstubAllGlobals();
});

function TimelineHarness() {
	const actions = useTimelineActions();
	return createElement(
		"div",
		null,
		createElement(
			"button",
			{ type: "button", onClick: () => actions.openComposer(12) },
			"Open composer",
		),
		createElement(TimelineComposer, {
			videoId,
			trackWidth: 800,
			windowStart: 0,
			windowEnd: 60,
			viewerSignedIn: true,
		}),
	);
}

async function renderComposer(kind: "comment" | "reply" | "timeline") {
	const submit = vi.fn();
	await act(async () => {
		if (kind === "timeline") {
			const props = {
				duration: 60,
				compact: false,
				hasHover: true,
				children: createElement(TimelineHarness),
			};
			const guestProps = { children: createElement(TimelineProvider, props) };
			root.render(createElement(GuestCommentNameProvider, guestProps));
			return;
		}
		root.render(
			createElement(CommentInput, {
				onSubmit: submit,
				buttonLabel: kind === "comment" ? "Comment" : "Reply",
				collapsible: kind === "comment",
				showCancelButton: kind === "reply",
				onCancel: vi.fn(),
			}),
		);
	});
	if (kind === "timeline") {
		const open = container.querySelector("button");
		if (!open) throw new Error("Composer trigger is missing");
		await act(async () => {
			open.click();
		});
	}
	const input = container.querySelector("textarea, input[placeholder]");
	if (
		!(input instanceof HTMLTextAreaElement || input instanceof HTMLInputElement)
	) {
		throw new Error("Comment field is missing");
	}
	return {
		input,
		submit: kind === "timeline" ? vi.mocked(newComment) : submit,
	};
}

async function change(
	input: HTMLInputElement | HTMLTextAreaElement,
	value: string,
) {
	await act(async () => {
		const prototype =
			input instanceof HTMLTextAreaElement
				? HTMLTextAreaElement.prototype
				: HTMLInputElement.prototype;
		const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
		if (!setter) throw new Error("Field value setter is missing");
		setter.call(input, value);
		input.dispatchEvent(new Event("input", { bubbles: true }));
	});
}

describe.each(["comment", "reply", "timeline"] as const)(
	"%s text composer",
	(kind) => {
		it("keeps the draft when Enter confirms an input method composition", async () => {
			const { input, submit } = await renderComposer(kind);
			await act(async () => {
				input.dispatchEvent(
					new CompositionEvent("compositionstart", { bubbles: true }),
				);
			});
			await change(input, "日本語");
			const confirm = new KeyboardEvent("keydown", {
				key: "Enter",
				isComposing: true,
				bubbles: true,
				cancelable: true,
			});
			await act(async () => {
				input.dispatchEvent(confirm);
			});

			expect(submit).not.toHaveBeenCalled();
			expect(input.isConnected).toBe(true);
			expect(input.value).toBe("日本語");
			expect(confirm.defaultPrevented).toBe(false);

			await act(async () => {
				input.dispatchEvent(
					new CompositionEvent("compositionend", {
						data: "日本語",
						bubbles: true,
					}),
				);
			});
			await act(async () => {
				input.dispatchEvent(
					new KeyboardEvent("keydown", {
						key: "Enter",
						bubbles: true,
						cancelable: true,
					}),
				);
			});
			expect(submit).toHaveBeenCalledOnce();
			if (kind === "comment" || kind === "reply")
				expect(submit).toHaveBeenCalledWith("日本語");
			else
				expect(submit).toHaveBeenCalledWith(
					expect.objectContaining({ content: "日本語", videoId }),
				);
		});
	},
);

it("leaves Shift+Enter available for multiline replies", async () => {
	const { input, submit } = await renderComposer("reply");
	await change(input, "First line");
	const newline = new KeyboardEvent("keydown", {
		key: "Enter",
		shiftKey: true,
		bubbles: true,
		cancelable: true,
	});
	await act(async () => {
		input.dispatchEvent(newline);
	});
	expect(newline.defaultPrevented).toBe(false);
	expect(submit).not.toHaveBeenCalled();
	expect(input.value).toBe("First line");
});

it.each(["success", "failure"])(
	"keeps a new draft below the toolbar when an earlier reaction finishes with %s",
	async (outcome) => {
		const respond = vi.mocked(newComment).getMockImplementation();
		if (!respond) throw new Error("Missing comment response");
		const reactionSave = Promise.withResolvers<void>();
		vi.mocked(newComment).mockImplementationOnce(async (data) => {
			await reactionSave.promise;
			return respond(data);
		});
		vi.spyOn(console, "error").mockImplementation(() => {});
		const success = vi.fn();
		await act(async () => {
			root.render(
				createElement(
					"div",
					null,
					createElement(Toolbar, {
						data: video,
						comments: [],
						onCommentSuccess: success,
						onWriteComment: () => container.querySelector("textarea")?.focus(),
					}),
					createElement(CommentInput, { buttonLabel: "Send" }),
				),
			);
		});
		const reaction = container.querySelector<HTMLButtonElement>(
			'button[aria-label="React with thumbs up, 0"]',
		);
		if (!reaction) throw new Error("Missing reaction button");
		await act(async () => reaction.click());
		expect(newComment).toHaveBeenCalledExactlyOnceWith(
			expect.objectContaining({ content: "👍", type: "emoji" }),
		);
		await act(async () => {
			window.dispatchEvent(
				new KeyboardEvent("keydown", { key: "c", cancelable: true }),
			);
		});
		const input = container.querySelector("textarea");
		if (!input) throw new Error("Missing comment field");
		expect(document.activeElement).toBe(input);
		await change(input, "A new draft after reacting");
		await act(async () => {
			if (outcome === "success") reactionSave.resolve();
			else reactionSave.reject(new Error("Offline"));
		});
		expect(input.value).toBe("A new draft after reacting");
		expect(container.querySelector("textarea")).toBe(input);
		expect(success).toHaveBeenCalledTimes(outcome === "success" ? 1 : 0);
	},
);

it("keeps the timeline draft and says so when the comment fails to post", async () => {
	vi.mocked(newComment).mockRejectedValueOnce(
		new Error("Feedback is disabled on this video"),
	);
	vi.spyOn(console, "error").mockImplementation(() => {});
	showError.mockReset();
	const { input } = await renderComposer("timeline");
	await change(input, "Worth keeping");
	await act(async () => {
		input.dispatchEvent(
			new KeyboardEvent("keydown", {
				key: "Enter",
				bubbles: true,
				cancelable: true,
			}),
		);
	});

	expect(newComment).toHaveBeenCalledOnce();
	expect(showError).toHaveBeenCalledExactlyOnceWith(
		"Couldn't post your comment. Please try again.",
	);
	const restored = container.querySelector("input");
	expect(restored?.value).toBe("Worth keeping");
	expect(restored?.getAttribute("aria-label")).toBe(
		input.getAttribute("aria-label"),
	);
});

it("leaves a newer timeline draft alone when an earlier comment fails", async () => {
	const save = Promise.withResolvers<Awaited<ReturnType<typeof newComment>>>();
	vi.mocked(newComment).mockImplementationOnce(() => save.promise);
	vi.spyOn(console, "error").mockImplementation(() => {});
	showError.mockReset();
	const { input } = await renderComposer("timeline");
	await change(input, "First draft");
	await act(async () => {
		input.dispatchEvent(
			new KeyboardEvent("keydown", {
				key: "Enter",
				bubbles: true,
				cancelable: true,
			}),
		);
	});
	const open = container.querySelector("button");
	if (!open) throw new Error("Composer trigger is missing");
	await act(async () => open.click());
	const newer = container.querySelector<HTMLInputElement>("input[placeholder]");
	if (!newer) throw new Error("Missing comment field");
	await change(newer, "Newer draft");
	await act(async () => {
		save.reject(new Error("Offline"));
	});

	expect(showError).toHaveBeenCalledExactlyOnceWith(
		"Couldn't post your comment. Please try again.",
	);
	expect(container.querySelector("input")).toBe(newer);
	expect(newer.value).toBe("Newer draft");
});

it("posts a guest comment at the strip anchor and keeps focus", async () => {
	auth.user = null;
	const { input } = await renderComposer("timeline");
	const name = container.querySelector<HTMLInputElement>(
		'input[name="guestName"]',
	);
	if (!name) throw new Error("Missing guest name field");
	await change(name, " Sam ");
	await change(input, "Guest feedback");
	await act(async () => {
		input.dispatchEvent(
			new KeyboardEvent("keydown", {
				key: "Enter",
				bubbles: true,
				cancelable: true,
			}),
		);
	});
	expect(postShareComment).toHaveBeenCalledWith(
		expect.objectContaining({
			content: "Guest feedback",
			guestName: "Sam",
			website: "",
			authorImage: null,
			timestamp: 12,
		}),
	);
	expect(window.localStorage.getItem("omashare.guestName")).toBe("Sam");
	expect(document.activeElement).toBe(input);
	expect(input.value).toBe("");
});
it("shows the timeline comment button on desktop with a hover pointer", async () => {
	vi.stubGlobal("matchMedia", (query: string) => ({
		matches:
			query === "(min-width: 1024px)" ||
			query === "(hover: hover) and (pointer: fine)",
		addEventListener: () => undefined,
		removeEventListener: () => undefined,
	}));
	const player = document.createElement("video");
	player.currentTime = 37;
	vi.spyOn(player, "pause").mockImplementation(() => undefined);
	container.before(player);
	const playbackProps = {
		videoRef: { current: player },
		stageRef: { current: null },
		fallbackDuration: 60,
		children: createElement(TimelineView, { videoId, comments: [] }),
	};
	const guestProps = {
		children: createElement(PlaybackProvider, playbackProps),
	};
	try {
		await act(async () =>
			root.render(createElement(GuestCommentNameProvider, guestProps)),
		);
		const trigger = container.querySelector<HTMLButtonElement>(
			'button[aria-label="Comment at current time"]',
		);
		expect(trigger).not.toBeNull();
		await act(async () => trigger?.click());
		expect(document.activeElement?.getAttribute("aria-label")).toBe(
			"Comment at 0:37",
		);
	} finally {
		player.remove();
	}
});

it("says so when a toolbar reaction fails to post", async () => {
	vi.mocked(newComment).mockRejectedValueOnce(new Error("Offline"));
	vi.spyOn(console, "error").mockImplementation(() => {});
	showError.mockReset();
	await act(async () => {
		root.render(createElement(Toolbar, { data: video, comments: [] }));
	});
	const reaction = container.querySelector<HTMLButtonElement>(
		'button[aria-label="React with thumbs up, 0"]',
	);
	if (!reaction) throw new Error("Missing reaction button");
	await act(async () => reaction.click());

	expect(newComment).toHaveBeenCalledOnce();
	expect(showError).toHaveBeenCalledExactlyOnceWith(
		"Couldn't add your reaction. Please try again.",
	);
});
