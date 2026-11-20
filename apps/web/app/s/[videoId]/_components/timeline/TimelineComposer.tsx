"use client";

import { Comment, type Video } from "@cap/web-domain";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { postShareComment } from "@/actions/videos/new-comment";
import { useCurrentUser } from "@/app/Layout/AuthContext";
import type { CommentType } from "../../Share";
import { AuthOverlay } from "../AuthOverlayLazy";
import {
	GuestCommentNameFields,
	normalizeGuestName,
	readGuestCommentFields,
	useGuestCommentName,
} from "../comments/GuestCommentName";
import { MicGlyph } from "./TimelineBranch";
import { useTimelineActions, useTimelineState } from "./TimelineProvider";
import {
	CARD_WIDTH,
	fractionInWindow,
	RAIL_PAD_X,
	usableWidth,
} from "./timeline-constants";
import { formatClock } from "./timeline-format";

/**
 * Recording kinds the composer can ask for. The timeline only expresses the
 * intent and the time it happened at; capture, upload and the optimistic media
 * comment all belong to whoever supplies `onRecordIntent`.
 */
export type RecordIntentKind = "screen" | "camera" | "voice";

export interface TimelineComposerProps {
	videoId: Video.VideoId;
	trackWidth: number;
	windowStart: number;
	windowEnd: number;
	/** Server's view of the viewer; the auth hook supplies who they are. */
	viewerSignedIn?: boolean;
	onOptimisticComment?: (comment: CommentType) => void;
	onCommentSuccess?: (comment: CommentType) => void;
	/** Overrides the locally owned auth dialog when the host has its own. */
	onRequestAuth?: () => void;
	/**
	 * Supplied by the recording phase. Until then the buttons stay out, but the
	 * row keeps its height so adding them later moves nothing.
	 */
	onRecordIntent?: (kind: RecordIntentKind, t: number) => void;
}

const RECORD_OPTIONS: { kind: RecordIntentKind; label: string }[] = [
	{ kind: "screen", label: "Record screen" },
	{ kind: "camera", label: "Record camera" },
	{ kind: "voice", label: "Record voice note" },
];

const clampCenter = (percent: number, trackWidth: number): number => {
	const x = RAIL_PAD_X + (percent / 100) * usableWidth(trackWidth);
	const half = CARD_WIDTH / 2;
	if (trackWidth < CARD_WIDTH + 16) return trackWidth / 2;
	return Math.min(Math.max(x, half + 8), trackWidth - half - 8);
};

/** Anchored "comment at this exact moment" card. */
export function TimelineComposer({
	videoId,
	trackWidth,
	windowStart,
	windowEnd,
	viewerSignedIn = false,
	onOptimisticComment,
	onCommentSuccess,
	onRequestAuth,
	onRecordIntent,
}: TimelineComposerProps) {
	const { composerAnchor } = useTimelineState();
	const { closeComposer } = useTimelineActions();
	const user = useCurrentUser();
	const reduceMotion = useReducedMotion() ?? false;
	const [value, setValue] = useState("");
	const [sending, startTransition] = useTransition();
	const pending = useRef(composerAnchor);
	const inputRef = useRef<HTMLInputElement>(null);
	const guestFields = useRef<HTMLDivElement>(null);
	const { name, remember } = useGuestCommentName();
	const [showAuthOverlay, setShowAuthOverlay] = useState(false);

	// Both have to agree: the page was rendered for a signed-in viewer and the
	// client knows who that is.
	const canRecord = viewerSignedIn && user !== null;
	const anchorTime = composerAnchor?.t ?? 0;

	useEffect(() => {
		setValue("");
		if (composerAnchor) inputRef.current?.focus();
	}, [composerAnchor]);

	const anchorRef = useRef(composerAnchor);
	anchorRef.current = composerAnchor;

	const requestAuth = () => {
		if (onRequestAuth) onRequestAuth();
		else setShowAuthOverlay(true);
	};

	const submit = () => {
		const content = value.trim();
		if (!content || pending.current || !composerAnchor) return;
		const fields = readGuestCommentFields(guestFields, name);
		const guestName = user ? null : normalizeGuestName(fields.guestName);
		if (!user && !guestName) {
			toast.error("Please add your name.");
			return;
		}
		const anchor = composerAnchor;
		const id = Comment.CommentId.make(`temp-${crypto.randomUUID()}`);
		const now = new Date();
		const parentCommentId = Comment.CommentId.make("");
		pending.current = anchor;
		startTransition(async () => {
			onOptimisticComment?.({
				id,
				authorId: user?.id ?? null,
				guestName,
				authorName: user ? user.name : guestName,
				authorImage: user?.imageUrl ?? null,
				content,
				createdAt: now,
				videoId,
				parentCommentId,
				type: "text",
				timestamp: anchor.t,
				updatedAt: now,
				mediaKey: null,
				mediaDuration: null,
				mediaMeta: null,
				sending: true,
			});
			try {
				const result = await postShareComment({
					content,
					videoId,
					authorImage: user?.imageUrl ?? null,
					parentCommentId,
					type: "text",
					timestamp: anchor.t,
					guestName: guestName ?? undefined,
					website: fields.website,
				});
				if (result.comment) {
					if (guestName) remember(guestName);
					onCommentSuccess?.({ ...result.comment, clientKey: id });
					if (anchorRef.current === anchor) setValue("");
				} else {
					toast.error(result.error);
				}
			} catch (error) {
				console.error("Error posting comment:", error);
				toast.error("Couldn't post your comment. Please try again.");
			} finally {
				pending.current = null;
				if (anchorRef.current === anchor) inputRef.current?.focus();
			}
		});
	};

	// Clamped into the window: zooming past the anchor must slide the card to
	// the edge it left through, not off the deck.
	const percent = Math.min(
		100,
		Math.max(0, fractionInWindow(anchorTime, windowStart, windowEnd) * 100),
	);

	return (
		<>
			<AnimatePresence>
				{composerAnchor && (
					<motion.div
						layout
						key="timeline-composer"
						className="absolute bottom-full z-50 mb-2 w-72"
						style={{
							left: clampCenter(percent, trackWidth),
							translateX: "-50%",
						}}
						initial={
							reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.9, y: 6 }
						}
						animate={
							reduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }
						}
						exit={
							reduceMotion
								? { opacity: 0, transition: { duration: 0 } }
								: { opacity: 0, scale: 0.94, transition: { duration: 0.12 } }
						}
						transition={
							reduceMotion
								? { duration: 0 }
								: { type: "spring", stiffness: 420, damping: 34 }
						}
						onBlur={(event) => {
							if (
								!value.trim() &&
								!sending &&
								!event.currentTarget.contains(event.relatedTarget)
							)
								closeComposer();
						}}
						onKeyDown={(event) => {
							if (event.key === "Escape") {
								event.stopPropagation();
								closeComposer();
							}
						}}
					>
						<div className="new-card-style flex flex-col gap-2 p-2.5">
							<div className="flex items-center gap-2">
								<span className="rounded-md bg-gray-2 px-1.5 py-0.5 font-mono text-[11px] tabular-nums text-gray-11 ring-1 ring-gray-4">
									{formatClock(anchorTime)}
								</span>
								<span className="text-xs text-gray-10">
									Comment at this moment
								</span>
							</div>

							{!user && <GuestCommentNameFields fieldsRef={guestFields} />}
							<input
								ref={inputRef}
								type="text"
								value={value}
								readOnly={sending && pending.current === composerAnchor}
								aria-busy={sending && pending.current === composerAnchor}
								maxLength={255}
								placeholder="Add a comment"
								aria-label={`Comment at ${formatClock(anchorTime)}`}
								onChange={(event) => setValue(event.target.value)}
								onKeyDown={(event) => {
									if (event.key === "Enter" && !event.nativeEvent.isComposing) {
										event.preventDefault();
										submit();
									}
								}}
								className="h-8 w-full rounded-lg bg-gray-2 px-2 text-sm text-gray-12 outline-none ring-1 ring-gray-4 placeholder:text-gray-9 focus:ring-blue-9"
							/>

							<div
								className="flex h-8 items-center gap-1"
								onPointerDown={(event) => event.preventDefault()}
							>
								{onRecordIntent
									? RECORD_OPTIONS.map((option) => (
											<button
												key={option.kind}
												type="button"
												aria-label={option.label}
												title={option.label}
												onClick={() => {
													if (!canRecord) {
														requestAuth();
														return;
													}
													onRecordIntent(option.kind, anchorTime);
												}}
												className="flex size-8 items-center justify-center rounded-lg text-gray-11 transition-colors hover:bg-gray-2 hover:text-gray-12"
											>
												<RecordIcon kind={option.kind} />
											</button>
										))
									: null}
								<button
									type="button"
									disabled={!value.trim() || sending}
									onClick={submit}
									className="ml-auto rounded-md bg-gray-12 px-3 py-1 text-sm text-white disabled:opacity-50"
								>
									Send
								</button>
							</div>
						</div>
					</motion.div>
				)}
			</AnimatePresence>

			{!onRequestAuth && (
				<AuthOverlay
					isOpen={showAuthOverlay}
					onClose={() => setShowAuthOverlay(false)}
				/>
			)}
		</>
	);
}

function RecordIcon({ kind }: { kind: RecordIntentKind }) {
	if (kind === "voice") return <MicGlyph />;
	if (kind === "camera") {
		return (
			<svg viewBox="0 0 16 16" className="size-4 fill-current" aria-hidden>
				<title>Camera</title>
				<path d="M2.5 4A1.5 1.5 0 0 0 1 5.5v5A1.5 1.5 0 0 0 2.5 12h6A1.5 1.5 0 0 0 10 10.5v-5A1.5 1.5 0 0 0 8.5 4h-6Zm9.2 2.4 2.6-1.5c.3-.2.7 0 .7.4v5.4c0 .4-.4.6-.7.4l-2.6-1.5V6.4Z" />
			</svg>
		);
	}
	return (
		<svg viewBox="0 0 16 16" className="size-4 fill-current" aria-hidden>
			<title>Screen</title>
			<path d="M2 4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4Zm3.2 9.4h5.6a.6.6 0 1 1 0 1.2H5.2a.6.6 0 1 1 0-1.2Z" />
		</svg>
	);
}
