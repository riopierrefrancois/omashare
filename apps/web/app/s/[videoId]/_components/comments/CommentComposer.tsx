import type { Video } from "@cap/web-domain";
import dynamic from "next/dynamic";
import { useRef, useState, useSyncExternalStore } from "react";
import { useCurrentUser } from "@/app/Layout/AuthContext";
import { SignedImageUrl } from "@/components/SignedImageUrl";
import { formatClock } from "@/lib/player-time";
import type { CommentType } from "../../Share";
import { RecordActionButtons } from "../media-comment/record-actions";
import { usePlayback } from "../playback/PlaybackContext";
import CommentInput from "../tabs/Activity/CommentInput";
import type { RecordIntentKind } from "../timeline/TimelineComposer";

const RecorderSurface = dynamic(
	() => import("../timeline/recording/RecorderSurface"),
	{ ssr: false },
);

export const SHARE_COMMENT_FIELD_ID = "share-comment-draft";

export type GuestName = {
	saved: string;
	draft: string;
	setDraft: (name: string) => void;
	edit: () => void;
};

export type CommentDraft = {
	content: string;
	timestamp: number | null;
	guestName: string;
	website: string;
};

export function CommentComposer({
	videoId,
	guestName,
	isScreenshot,
	onSubmit,
	onCancel,
	canRecordMedia = false,
	onOptimisticComment,
	onCommentSuccess,
}: {
	videoId: Video.VideoId;
	guestName: GuestName;
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
	const website = useRef<HTMLInputElement>(null);
	const hasTimestamp = !isScreenshot && includeTime;

	return (
		<div className="space-y-2">
			{!user &&
				(guestName.saved ? (
					<div className="flex flex-wrap items-center gap-1 text-sm text-gray-11">
						<span>Commenting as {guestName.saved} ·</span>
						<button
							type="button"
							className="text-gray-10 underline"
							onClick={guestName.edit}
						>
							Change
						</button>
					</div>
				) : (
					<label className="flex flex-wrap items-center gap-2 text-sm text-gray-11">
						Your name
						<input
							autoComplete="name"
							value={guestName.draft}
							onChange={(event) => guestName.setDraft(event.target.value)}
							className="rounded-lg border border-gray-5 bg-white px-2 py-1 text-gray-12"
						/>
					</label>
				))}
			{!user && (
				<input
					hidden
					ref={website}
					type="text"
					name="website"
					aria-label="Website"
					tabIndex={-1}
					autoComplete="off"
				/>
			)}
			{!isScreenshot && (
				<button
					type="button"
					aria-label={hasTimestamp ? "Remove time" : "Add current time"}
					className="rounded-full bg-gray-3 px-2 py-0.5 text-xs text-gray-11 hover:bg-gray-4"
					onClick={() => setIncludeTime(!includeTime)}
				>
					{hasTimestamp ? `at ${time} ×` : "Add time"}
				</button>
			)}
			<CommentInput
				inputId={onCancel ? undefined : SHARE_COMMENT_FIELD_ID}
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
						guestName: guestName.saved || guestName.draft,
						website: website.current?.value ?? "",
					});
				}}
				onCancel={onCancel}
				buttonLabel="Send"
				showCancelButton={Boolean(onCancel)}
				showErrorMessage
				autoFocus={Boolean(onCancel)}
				avatar={
					user && (
						<SignedImageUrl
							image={user.imageUrl}
							name={user.name ?? "You"}
							className="size-7 shrink-0 rounded-full"
							letterClass="text-xs"
						/>
					)
				}
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
