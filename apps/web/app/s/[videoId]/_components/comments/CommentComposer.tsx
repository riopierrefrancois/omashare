import type { Video } from "@cap/web-domain";
import clsx from "clsx";
import dynamic from "next/dynamic";
import { useRef, useState, useSyncExternalStore } from "react";
import { useCurrentUser } from "@/app/Layout/AuthContext";
import { formatClock } from "@/lib/player-time";
import type { CommentType } from "../../Share";
import { RecordActionButtons } from "../media-comment/record-actions";
import { usePlayback } from "../playback/PlaybackContext";
import CommentInput from "../tabs/Activity/CommentInput";
import type { RecordIntentKind } from "../timeline/TimelineComposer";
import {
	GuestCommentNameFields,
	readGuestCommentFields,
	useGuestCommentName,
} from "./GuestCommentName";

const RecorderSurface = dynamic(
	() => import("../timeline/recording/RecorderSurface"),
	{ ssr: false },
);

export const SHARE_COMMENT_FIELD_ID = "share-comment-draft";

export type CommentDraft = {
	content: string;
	timestamp: number | null;
	guestName: string;
	website: string;
};

export function CommentComposer({
	videoId,
	isScreenshot,
	onSubmit,
	onCancel,
	canRecordMedia = false,
	onOptimisticComment,
	onCommentSuccess,
}: {
	videoId: Video.VideoId;
	isScreenshot?: boolean;
	onSubmit: (draft: CommentDraft) => Promise<void>;
	onCancel?: () => void;
	canRecordMedia?: boolean;
	onOptimisticComment?: (comment: CommentType) => void;
	onCommentSuccess?: (comment: CommentType) => void;
}) {
	const user = useCurrentUser();
	const playback = usePlayback();
	const time = formatClock(
		useSyncExternalStore(
			playback.subscribe,
			() => Math.floor(playback.getCurrentTime()),
			() => 0,
		),
	);
	const [includeTime, setIncludeTime] = useState(!isScreenshot);
	const [recordIntent, setRecordIntent] = useState<{
		kind: RecordIntentKind;
		t: number;
	}>();
	const guestFields = useRef<HTMLDivElement>(null);
	const { name } = useGuestCommentName();
	const hasTimestamp = !isScreenshot && includeTime;

	return (
		<div
			className={clsx(
				"relative space-y-2 rounded-2xl border-[1.5px] border-solid border-[var(--share-accent,#2959C4)] bg-white px-3 py-2",
				!onCancel && "max-sm:rounded-none max-sm:border-0",
			)}
		>
			<div className="flex flex-wrap items-center justify-between gap-2">
				{user ? (
					<p className="text-sm text-gray-11">
						Commenting as{" "}
						<strong className="font-medium text-[var(--share-ink)]">
							{user.name ?? "You"}
						</strong>
					</p>
				) : (
					<GuestCommentNameFields fieldsRef={guestFields} />
				)}
				{!isScreenshot && (
					<button
						type="button"
						aria-label={hasTimestamp ? "Remove time" : "Add current time"}
						className="min-h-7 rounded-md bg-[var(--share-accent-soft)] px-2 font-mono text-xs font-medium text-[var(--share-accent-text)] hover:brightness-95"
						onClick={() => setIncludeTime(!includeTime)}
					>
						{hasTimestamp ? `at ${time} ✕` : "Add time"}
					</button>
				)}
			</div>
			<CommentInput
				inputId={onCancel ? undefined : SHARE_COMMENT_FIELD_ID}
				compactOnPhone={!onCancel}
				placeholder={
					onCancel
						? "Write a reply…"
						: hasTimestamp
							? `Write a comment at ${time}…`
							: "Write a comment…"
				}
				onSubmit={async (content) => {
					await onSubmit({
						content,
						timestamp: hasTimestamp ? playback.getCurrentTime() : null,
						...readGuestCommentFields(guestFields, name),
					});
				}}
				onCancel={onCancel}
				buttonLabel="Send"
				showCancelButton={Boolean(onCancel)}
				showErrorMessage
				autoFocus={Boolean(onCancel)}
				actions={
					user &&
					canRecordMedia && (
						<RecordActionButtons
							onSelect={(kind) => {
								const t = playback.getCurrentTime();
								playback.pause();
								setRecordIntent({ kind, t });
							}}
						/>
					)
				}
			/>
			{recordIntent && (
				<RecorderSurface
					kind={recordIntent.kind}
					timestamp={recordIntent.t}
					videoId={videoId}
					onOptimisticComment={onOptimisticComment}
					onCommentSuccess={onCommentSuccess}
					onClose={() => setRecordIntent(undefined)}
					placement="floating"
				/>
			)}
		</div>
	);
}
