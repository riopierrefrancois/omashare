import type { Comment, Video } from "@cap/web-domain";
import { useSearchParams } from "next/navigation";
import type React from "react";
import {
	startTransition,
	useCallback,
	useEffect,
	useMemo,
	useState,
} from "react";
import { toast } from "sonner";
import { deleteComment } from "@/actions/videos/delete-comment";
import { postShareComment } from "@/actions/videos/new-comment";
import { useCurrentUser } from "@/app/Layout/AuthContext";
import type { CommentType } from "../../Share";

import { CommentCard } from "./CommentCard";
import { CommentComposer, type CommentDraft } from "./CommentComposer";
import { normalizeGuestName, useGuestCommentName } from "./GuestCommentName";

const EMPTY_REPLIES: CommentType[] = [];

export function ShareComments(props: {
	setComments: React.Dispatch<React.SetStateAction<CommentType[]>>;
	videoId: Video.VideoId;
	optimisticComments: CommentType[];
	setOptimisticComments: (newComment: CommentType) => void;
	handleCommentSuccess: (comment: CommentType) => void;
	onSeek?: (time: number) => void;
	commentsDisabled: boolean;
	isVideoOwner?: boolean;
	commentsData?: CommentType[];
	isScreenshot?: boolean;
	canRecordMedia?: boolean;
}) {
	const {
		optimisticComments,
		setOptimisticComments,
		setComments,
		handleCommentSuccess,
		onSeek,
		commentsDisabled,
		videoId,
	} = props;
	const params = useSearchParams();
	const focusedId = params.get("reply") ?? params.get("comment");
	const user = useCurrentUser();
	const { remember } = useGuestCommentName();
	const [flashId, setFlashId] = useState<Comment.CommentId | null>(null);
	const [replyTarget, setReplyTarget] = useState<{
		rootId: Comment.CommentId;
		recipient: CommentType;
	}>();
	const selectReply = useCallback(
		(root: CommentType, recipient?: CommentType) => {
			setReplyTarget((current) =>
				recipient
					? { rootId: root.id, recipient }
					: current?.rootId === root.id
						? undefined
						: current,
			);
		},
		[],
	);

	useEffect(() => {
		if (!flashId) return;
		const timeout = setTimeout(() => setFlashId(null), 1500);
		return () => clearTimeout(timeout);
	}, [flashId]);

	const { rootComments, repliesByRoot } = useMemo(() => {
		const entries = optimisticComments.filter(({ type }) => type !== "emoji");
		const byId = new Map(entries.map((comment) => [comment.id, comment]));
		const byOldest = (a: CommentType, b: CommentType) =>
			new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
		const rootComments = entries
			.filter((comment) => !comment.parentCommentId)
			.reverse()
			.sort((a, b) => byOldest(b, a));
		const repliesByRoot = new Map<Comment.CommentId, CommentType[]>();
		for (const comment of entries) {
			if (!comment.parentCommentId) continue;
			let parent = byId.get(comment.parentCommentId);
			const visited = new Set([comment.id]);
			while (parent?.parentCommentId && !visited.has(parent.id)) {
				visited.add(parent.id);
				parent = byId.get(parent.parentCommentId);
			}
			if (!parent || parent.parentCommentId) continue;
			const replies = repliesByRoot.get(parent.id);
			if (replies) replies.push(comment);
			else repliesByRoot.set(parent.id, [comment]);
		}
		for (const replies of repliesByRoot.values()) replies.sort(byOldest);
		return { rootComments, repliesByRoot };
	}, [optimisticComments]);

	const submit = async (draft: CommentDraft, root?: CommentType) => {
		const { content, timestamp, website } = draft;
		const guestName = user ? null : normalizeGuestName(draft.guestName);
		if (!user && !guestName) {
			throw new Error("Please add your name.");
		}
		const parentCommentId = root?.id ?? ("" as Comment.CommentId);
		const id = `temp-${crypto.randomUUID()}` as Comment.CommentId;
		const now = new Date();
		setOptimisticComments({
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
			timestamp,
			updatedAt: now,
			mediaKey: null,
			mediaDuration: null,
			mediaMeta: null,
			sending: true,
		});

		const result = await postShareComment({
			content,
			videoId,
			authorImage: user?.imageUrl ?? null,
			parentCommentId,
			type: "text",
			timestamp,
			guestName: guestName ?? undefined,
			website,
		}).catch((error) => {
			console.error("Failed to post comment:", error);
			throw new Error("Couldn't post your comment. Please try again.");
		});
		if (!result.comment) throw new Error(result.error);
		if (guestName) remember(guestName);
		handleCommentSuccess({ ...result.comment, clientKey: id });
		setFlashId(result.comment.id);
	};

	const handleDeleteComment = useCallback(
		async (comment: CommentType) => {
			try {
				const deleted = await deleteComment({
					commentId: comment.id,
					parentId: comment.parentCommentId,
					videoId,
					deleteReplies: !comment.parentCommentId,
				});
				const ids = new Set(deleted.deletedIds ?? [comment.id]);
				setComments((prev) => prev.filter(({ id }) => !ids.has(id)));
				return true;
			} catch (error) {
				console.error("Failed to delete comment:", error);
				toast.error("Couldn't delete the comment. Please try again.");
				return false;
			}
		},
		[videoId, setComments],
	);

	const count = optimisticComments.filter(
		({ type }) => type !== "emoji",
	).length;
	return (
		<section aria-label="Comments" className="min-w-0 space-y-3">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<h2 className="text-xs font-semibold uppercase tracking-wide text-gray-11 sm:text-base sm:normal-case sm:tracking-normal">
					Comments{" "}
					<span className="text-sm font-normal text-gray-10">{count}</span>
				</h2>
			</div>
			{commentsDisabled ? (
				<p className="text-sm text-gray-10">
					Comments are turned off for this video.
				</p>
			) : rootComments.length === 0 ? (
				<p className="text-sm text-gray-10">No comments yet. Be the first.</p>
			) : (
				<div className="space-y-3">
					{rootComments.map((comment) => {
						const replies = repliesByRoot.get(comment.id) ?? EMPTY_REPLIES;
						const contains = (id: string | null) =>
							id === comment.id || replies.some((reply) => reply.id === id);
						return (
							<CommentCard
								key={comment.clientKey ?? comment.id}
								comment={comment}
								replies={replies}
								isVideoOwner={props.isVideoOwner}
								flashId={contains(flashId) ? flashId : null}
								renderReply={
									!commentsDisabled && replyTarget?.rootId === comment.id
										? (root, cancel) => (
												<CommentComposer
													key={replyTarget.recipient.id}
													videoId={videoId}
													isScreenshot={props.isScreenshot}
													onCancel={cancel}
													onSubmit={async (draft) => {
														await submit(draft, root);
														cancel();
													}}
												/>
											)
										: undefined
								}
								viewerId={user?.id}
								recipient={
									!commentsDisabled && replyTarget?.rootId === comment.id
										? replyTarget.recipient
										: undefined
								}
								onSelectReply={commentsDisabled ? undefined : selectReply}
								onDelete={handleDeleteComment}
								onSeek={onSeek}
								focusedId={contains(focusedId) ? focusedId : null}
							/>
						);
					})}
				</div>
			)}
			{!commentsDisabled && (
				<div className="share-comment-dock max-sm:fixed max-sm:inset-x-0 max-sm:bottom-0 max-sm:z-30 max-sm:border-t max-sm:border-gray-5 max-sm:bg-white max-sm:pb-[env(safe-area-inset-bottom)]">
					<CommentComposer
						videoId={videoId}
						isScreenshot={props.isScreenshot}
						canRecordMedia={props.canRecordMedia}
						onSubmit={submit}
						onOptimisticComment={(comment) =>
							startTransition(() => setOptimisticComments(comment))
						}
						onCommentSuccess={(comment) => {
							handleCommentSuccess(comment);
							setFlashId(comment.id);
						}}
					/>
				</div>
			)}
		</section>
	);
}
