// type-only on purpose: a value import of @cap/web-domain drags the whole
// effect runtime (~250 KB gz) into the share page's entry chunk. The branded
// ids carry no constraints, so plain casts replace `.make()` losslessly.
import type { Comment, User, Video } from "@cap/web-domain";
import { useSearchParams } from "next/navigation";
import type React from "react";
import {
	type PropsWithChildren,
	Suspense,
	startTransition,
	useCallback,
	useMemo,
	useState,
} from "react";
import { toast } from "sonner";
import { deleteComment } from "@/actions/videos/delete-comment";
import { newComment } from "@/actions/videos/new-comment";
import { CapCardAnalytics } from "@/app/(org)/dashboard/caps/components/CapCard/CapCardAnalytics";
import { useCurrentUser } from "@/app/Layout/AuthContext";
import type { CommentType } from "../../Share";
import { AuthOverlay } from "../AuthOverlayLazy";
import { ActivityComposer } from "../tabs/Activity/ActivityComposer";

import CommentAnalytics from "./CommentAnalytics";
import { CommentCard } from "./CommentCard";

const EMPTY_REPLIES: CommentType[] = [];

export const ShareComments = Object.assign(
	(props: {
		setComments: React.Dispatch<React.SetStateAction<CommentType[]>>;
		videoId: Video.VideoId;
		optimisticComments: CommentType[];
		setOptimisticComments: (newComment: CommentType) => void;
		handleCommentSuccess: (comment: CommentType) => void;
		onSeek?: (time: number) => void;
		setShowAuthOverlay?: (v: boolean) => void;
		commentsDisabled: boolean;
		isVideoOwner?: boolean;
		ownerOrMemberViews?: MaybePromise<number>;
		commentsData?: CommentType[];
		ownerName?: string | null;
		canRecordMedia?: boolean;
	}) => {
		const {
			optimisticComments,
			setOptimisticComments,
			setComments,
			handleCommentSuccess,
			onSeek,
			commentsDisabled,
			videoId,
		} = props;
		const commentParams = useSearchParams().get("comment");
		const replyParams = useSearchParams().get("reply");
		const user = useCurrentUser();
		const [showAuthOverlay, setShowAuth] = useState(false);
		const [replyTarget, setReplyTarget] = useState<{
			rootId: Comment.CommentId;
			recipient: CommentType;
		}>();
		const selectReply = useCallback(
			(root: CommentType, recipient?: CommentType) => {
				if (recipient && !user) {
					(props.setShowAuthOverlay ?? setShowAuth)(true);
					return;
				}
				setReplyTarget(recipient ? { rootId: root.id, recipient } : undefined);
			},
			[user, props.setShowAuthOverlay],
		);
		const setShowAuthOverlay = props.setShowAuthOverlay ?? setShowAuth;

		const { rootComments, repliesByRoot } = useMemo(() => {
			const entries = optimisticComments.filter(({ type }) => type !== "emoji");
			const byId = new Map(entries.map((comment) => [comment.id, comment]));
			const byOldest = (a: CommentType, b: CommentType) =>
				new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
			const rootComments = entries
				.filter((comment) => !comment.parentCommentId)
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

		const handleNewComment = async (content: string) => {
			if (!user) return;

			// Get current video time from the video element
			const videoElement = document.querySelector("video") as HTMLVideoElement;
			const currentTime = videoElement?.currentTime || 0;

			const optimisticComment: CommentType = {
				id: `temp-${Date.now()}` as Comment.CommentId,
				authorId: user.id as User.UserId,
				authorName: user?.name,
				authorImage: user.imageUrl,
				content,
				createdAt: new Date(),
				videoId,
				parentCommentId: "" as Comment.CommentId,
				type: "text",
				timestamp: currentTime,
				updatedAt: new Date(),
				mediaKey: null,
				mediaDuration: null,
				mediaMeta: null,
				sending: true,
			};

			startTransition(() => {
				setOptimisticComments(optimisticComment);
			});

			const data = await newComment({
				content,
				videoId,
				authorImage: user.imageUrl,
				parentCommentId: "" as Comment.CommentId,
				type: "text",
				timestamp: currentTime,
			});
			handleCommentSuccess(data);
		};

		const handleReply = useCallback(
			async (content: string, root: CommentType) => {
				if (!user) {
					setShowAuthOverlay(true);
					throw new Error("Sign in to reply.");
				}
				const currentTime = document.querySelector("video")?.currentTime ?? 0;
				const id = `temp-${crypto.randomUUID()}` as Comment.CommentId;
				const now = new Date();
				setOptimisticComments({
					id,
					authorId: user.id,
					authorName: user.name,
					authorImage: user.imageUrl,
					content,
					createdAt: now,
					videoId,
					parentCommentId: root.id,
					type: "text",
					timestamp: currentTime,
					updatedAt: now,
					mediaKey: null,
					mediaDuration: null,
					mediaMeta: null,
					sending: true,
				});
				const saved = await newComment({
					content,
					videoId,
					parentCommentId: root.id,
					type: "text",
					timestamp: currentTime,
					authorImage: user.imageUrl,
				});
				handleCommentSuccess({ ...saved, clientKey: id });
			},
			[
				user,
				videoId,
				setOptimisticComments,
				handleCommentSuccess,
				setShowAuthOverlay,
			],
		);

		const handleDeleteComment = useCallback(
			async (comment: CommentType) => {
				try {
					const deleted = await deleteComment({
						commentId: comment.id,
						parentId: comment.parentCommentId,
						videoId,
						deleteReplies: !comment.parentCommentId,
					});
					const ids = new Set(deleted?.deletedIds ?? [comment.id]);
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
					<h2 className="text-base font-semibold text-gray-12">
						Comments{" "}
						<span className="text-sm font-normal text-gray-10">{count}</span>
					</h2>
					{props.ownerOrMemberViews !== undefined && (
						<Suspense fallback={<CapCardAnalytics.Skeleton />}>
							<CommentAnalytics
								videoId={videoId}
								views={props.ownerOrMemberViews}
								comments={props.commentsData ?? optimisticComments}
								isLoadingAnalytics={false}
								isOwner={Boolean(props.isVideoOwner)}
							/>
						</Suspense>
					)}
				</div>
				<ShareComments.Shell
					commentInputProps={{
						onSubmit: handleNewComment,
						disabled: commentsDisabled,
					}}
					setShowAuthOverlay={setShowAuthOverlay}
					videoId={props.videoId}
					ownerName={props.ownerName}
					canRecordMedia={props.canRecordMedia}
					onOptimisticComment={(comment) => {
						startTransition(() => {
							setOptimisticComments(comment);
						});
					}}
					onCommentSuccess={handleCommentSuccess}
				>
					{commentsDisabled ? (
						<p className="text-sm text-gray-10">
							Comments are turned off for this video.
						</p>
					) : rootComments.length === 0 ? (
						<p className="text-sm text-gray-10">
							No comments yet. Be the first.
						</p>
					) : (
						<div className="space-y-3">
							{rootComments.map((comment) => (
								<CommentCard
									key={comment.clientKey ?? comment.id}
									comment={comment}
									replies={repliesByRoot.get(comment.id) ?? EMPTY_REPLIES}
									isVideoOwner={props.isVideoOwner}
									onReply={handleReply}
									viewerId={user?.id}
									recipient={
										replyTarget?.rootId === comment.id
											? replyTarget.recipient
											: undefined
									}
									onSelectReply={selectReply}
									onDelete={handleDeleteComment}
									onSeek={onSeek}
									focusedId={replyParams ?? commentParams}
								/>
							))}
						</div>
					)}
				</ShareComments.Shell>
				{showAuthOverlay && (
					<AuthOverlay
						isOpen={showAuthOverlay}
						onClose={() => setShowAuth(false)}
					/>
				)}
			</section>
		);
	},
	{
		Shell: (
			props: PropsWithChildren<{
				setShowAuthOverlay: (v: boolean) => void;
				commentInputProps?: {
					onSubmit?: (content: string) => void | Promise<void>;
					disabled?: boolean;
				};
				commentsContainerRef?: React.RefObject<HTMLDivElement | null>;
				videoId?: Video.VideoId;
				/** Whose video this is, for the composer's placeholder. */
				ownerName?: string | null;
				canRecordMedia?: boolean;
				onOptimisticComment?: (comment: CommentType) => void;
				onCommentSuccess?: (comment: CommentType) => void;
			}>,
		) => (
			<>
				<div ref={props.commentsContainerRef} className="min-w-0">
					{props.children}
				</div>

				{!props.commentInputProps?.disabled && props.videoId && (
					<div className="mt-3 rounded-xl border border-gray-5 bg-gray-2 p-2">
						<ActivityComposer
							videoId={props.videoId}
							ownerName={props.ownerName}
							onSubmit={(content) =>
								props.commentInputProps?.onSubmit?.(content)
							}
							setShowAuthOverlay={props.setShowAuthOverlay}
							canRecordMedia={props.canRecordMedia}
							onOptimisticComment={props.onOptimisticComment}
							onCommentSuccess={props.onCommentSuccess}
						/>
					</div>
				)}
			</>
		),
		Skeleton: (props: { setShowAuthOverlay: (v: boolean) => void }) => (
			<ShareComments.Shell {...props} commentInputProps={{ disabled: true }} />
		),
	},
);
