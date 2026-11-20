import clsx from "clsx";
import {
	memo,
	type ReactNode,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { LinkifiedText } from "@/components/LinkifiedText";
import { SignedImageUrl } from "@/components/SignedImageUrl";
import { formatClock } from "@/lib/player-time";
import type { CommentType } from "../../Share";
import { MediaCommentBody } from "../media-comment/MediaCommentBody";
import { isMediaComment } from "../media-comment/media-comment-types";
import { RelativeTime } from "../RelativeTime";
import { formatTimeAgo, formatTimestamp } from "../tabs/Activity/utils";

export const replyCountLabel = (count: number) =>
	`${count} ${count === 1 ? "reply" : "replies"}`;

const nameOf = (comment: CommentType) =>
	comment.authorName ?? comment.guestName ?? "Guest";

const quietButton =
	"rounded px-1.5 py-1 text-sm text-gray-10 hover:bg-gray-3 hover:text-gray-12";

type DeleteComment = (comment: CommentType) => Promise<boolean>;

function DeleteControl({
	isReply,
	count,
	onDelete,
}: {
	isReply: boolean;
	count: number;
	onDelete: () => Promise<boolean>;
}) {
	const [mode, setMode] = useState<"closed" | "menu" | "confirm">("closed");
	const [pending, setPending] = useState(false);
	const label = isReply ? "reply" : "comment";

	if (mode === "confirm") {
		return (
			<div className="flex basis-full flex-wrap items-center gap-2 rounded-lg border border-gray-5 bg-gray-2 p-2 text-sm">
				<span>
					Delete this {label}
					{count > 0 ? ` and its ${replyCountLabel(count)}` : ""}? It can't be
					undone.
				</span>
				<button
					type="button"
					className="font-medium text-red-600"
					disabled={pending}
					onClick={async () => {
						setPending(true);
						const deleted = await onDelete();
						setPending(false);
						if (deleted) setMode("closed");
					}}
				>
					Yes, delete
				</button>
				<button
					type="button"
					className={quietButton}
					disabled={pending}
					onClick={() => setMode("closed")}
				>
					Keep
				</button>
			</div>
		);
	}

	return (
		<div className="relative ml-auto shrink-0">
			<button
				type="button"
				className={quietButton}
				aria-label={`Options for this ${label}`}
				aria-expanded={mode === "menu"}
				onClick={() => setMode(mode === "menu" ? "closed" : "menu")}
			>
				•••
			</button>
			{mode === "menu" && (
				<div className="absolute right-0 z-10 rounded-lg border border-gray-5 bg-white p-1 shadow-sm">
					<button
						type="button"
						className={quietButton}
						onClick={() => setMode("confirm")}
					>
						Delete
					</button>
				</div>
			)}
		</div>
	);
}

function Face({
	comment,
	isReply,
}: {
	comment: CommentType;
	isReply?: boolean;
}) {
	return (
		<SignedImageUrl
			image={comment.authorImage}
			name={nameOf(comment)}
			className={clsx(
				"shrink-0 rounded-full",
				isReply ? "mt-1 size-7" : "size-8",
			)}
			letterClass="text-xs"
		/>
	);
}

function CommentDetails({
	comment,
	isReply = false,
	onSeek,
	onDelete,
	replyCount = 0,
}: {
	comment: CommentType;
	isReply?: boolean;
	onSeek?: (time: number) => void;
	onDelete?: () => Promise<boolean>;
	replyCount?: number;
}) {
	const timestamp = comment.timestamp;
	const date = new Date(comment.createdAt);
	return (
		<>
			<div className="flex flex-wrap items-center gap-x-2 gap-y-1">
				{!isReply && <Face comment={comment} />}
				<span className="min-w-0 break-all text-sm font-semibold">
					{nameOf(comment)}
				</span>
				<span className="text-xs text-gray-10" title={formatTimestamp(date)}>
					<RelativeTime date={date} format={formatTimeAgo} />
				</span>
				{!isReply && timestamp !== null && onSeek && (
					<button
						type="button"
						className="min-h-7 rounded-md bg-[var(--share-accent-soft)] px-2 font-mono text-xs font-semibold text-[var(--share-accent-text)] hover:brightness-95"
						aria-label={`Seek to ${formatClock(timestamp)}`}
						onClick={() => onSeek(timestamp)}
					>
						<span aria-hidden>▶ </span>
						{formatClock(timestamp)}
					</button>
				)}
				{onDelete && (
					<DeleteControl
						isReply={isReply}
						count={replyCount}
						onDelete={onDelete}
					/>
				)}
			</div>
			{isMediaComment(comment) && (
				<MediaCommentBody comment={comment} compact />
			)}
			{comment.content && (
				<p className="mt-2 whitespace-pre-wrap break-words text-[15px] leading-relaxed">
					<LinkifiedText text={comment.content} />
				</p>
			)}
		</>
	);
}

export const CommentCard = memo(function CommentCard({
	comment,
	replies,
	isVideoOwner,
	onSeek,
	onDelete,
	renderReply,
	viewerId,
	recipient,
	onSelectReply,
	focusedId,
	flashId,
}: {
	comment: CommentType;
	replies: CommentType[];
	isVideoOwner?: boolean;
	onSeek?: (time: number) => void;
	onDelete: DeleteComment;
	renderReply?: (root: CommentType, cancel: () => void) => ReactNode;
	viewerId?: string;
	recipient?: CommentType;
	onSelectReply?: (root: CommentType, recipient?: CommentType) => void;
	focusedId?: string | null;
	flashId?: string | null;
}) {
	const rootReply = useRef<HTMLButtonElement>(null);
	const restoreReplyFocus = useRef(false);
	useLayoutEffect(() => {
		if (recipient || !restoreReplyFocus.current) return;
		restoreReplyFocus.current = false;
		rootReply.current?.focus();
	}, [recipient]);
	const [expanded, setExpanded] = useState<boolean>();
	const hidden = Math.max(0, replies.length - 2);
	const showAll =
		(expanded ?? replies.slice(0, hidden).some(({ id }) => id === focusedId)) ||
		replies.slice(0, hidden).some(({ id }) => id === flashId);
	const canDelete = (entry: CommentType) =>
		!entry.sending &&
		(viewerId === entry.authorId || (isVideoOwner && entry.authorId === null));
	const canDeleteRoot =
		canDelete(comment) &&
		(isVideoOwner || !replies.some(({ authorId }) => authorId === null));
	const activeId = flashId ?? focusedId;

	const lastScroll = useRef<{ focused?: string; flashed?: string }>({});
	useEffect(() => {
		const kind = flashId ? "flashed" : "focused";
		if (!activeId || lastScroll.current[kind] === activeId) return;
		if (activeId !== comment.id && !replies.some(({ id }) => id === activeId))
			return;
		const element = document.getElementById(`comment-${activeId}`);
		if (element) {
			lastScroll.current[kind] = activeId;
			element.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
		}
	}, [activeId, comment.id, replies, flashId]);

	return (
		<article
			id={`comment-${comment.id}`}
			className={clsx(
				"flex min-w-0 flex-col gap-2 rounded-2xl border border-gray-5 bg-white px-3 py-2",
				comment.id === activeId && "ring-2 ring-[var(--share-accent)]",
				comment.sending && !isMediaComment(comment) && "opacity-60",
			)}
		>
			<CommentDetails
				comment={comment}
				onSeek={onSeek}
				replyCount={replies.length}
				onDelete={canDeleteRoot ? () => onDelete(comment) : undefined}
			/>
			<div className="flex items-center gap-2">
				{onSelectReply && !comment.sending && (
					<button
						type="button"
						className="rounded py-1 text-sm font-medium text-[#4F75FE] hover:underline"
						ref={rootReply}
						onClick={() => onSelectReply(comment, comment)}
					>
						Reply
					</button>
				)}
				{replies.length > 0 && (
					<span className="text-xs text-gray-10">
						{replyCountLabel(replies.length)}
					</span>
				)}
			</div>
			{(replies.length > 0 || recipient) && (
				<div className="space-y-3 border-t border-gray-5 pt-3">
					{hidden > 0 && (
						<button
							type="button"
							className={quietButton}
							aria-expanded={showAll}
							onClick={() => setExpanded(!showAll)}
						>
							{showAll
								? "Show fewer replies"
								: `Show ${hidden} earlier ${hidden === 1 ? "reply" : "replies"}`}
						</button>
					)}
					{(showAll ? replies : replies.slice(-2)).map((reply) => (
						<div
							key={reply.clientKey ?? reply.id}
							id={`comment-${reply.id}`}
							className={clsx(
								"flex items-start gap-2.5 rounded-2xl",
								reply.id === activeId && "ring-2 ring-[var(--share-accent)]",
								reply.sending && !isMediaComment(reply) && "opacity-60",
							)}
						>
							<Face comment={reply} isReply />
							<div className="min-w-0 flex-1">
								<div className="rounded-2xl border border-gray-5 bg-[var(--share-page,white)] px-3 pb-2 pt-1.5">
									<CommentDetails
										comment={reply}
										isReply
										onSeek={onSeek}
										onDelete={
											canDelete(reply) ? () => onDelete(reply) : undefined
										}
									/>
								</div>
							</div>
						</div>
					))}
					{recipient && (
						<div>
							<p className="mb-2 text-sm text-gray-10">
								Replying to {nameOf(recipient)}
							</p>
							{renderReply?.(comment, () => {
								restoreReplyFocus.current = true;
								onSelectReply?.(comment);
							})}
						</div>
					)}
				</div>
			)}
		</article>
	);
});
