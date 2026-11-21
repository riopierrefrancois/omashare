import { Button } from "@cap/ui";
// type-only on purpose: a value import of @cap/web-domain drags the whole
// effect runtime (~250 KB gz) into the share page's entry chunk. The branded
// ids carry no constraints, so plain casts replace `.make()` losslessly.
import type { Comment } from "@cap/web-domain";
import { AnimatePresence, motion } from "motion/react";
import { startTransition, useEffect, useState } from "react";
import { toast } from "sonner";
import { newComment } from "@/actions/videos/new-comment";
import { useCurrentUser } from "@/app/Layout/AuthContext";
import type { CommentType } from "../Share";
import type { VideoData } from "../types";
import { AuthOverlay } from "./AuthOverlayLazy";
import { handleEmojiReaction, REACTIONS } from "./toolbar-reactions";

const MotionButton = motion.create(Button);

// million-ignore
interface ToolbarProps {
	data: VideoData;
	onOptimisticComment?: (comment: CommentType) => void;
	onCommentSuccess?: (comment: CommentType) => void;
	disableComments?: boolean;
	disableReactions?: boolean;
	onWriteComment?: () => void;
}

interface EmojiButtonProps {
	label: string;
	emoji: string;
	onClick: () => void;
}

const EmojiButton = ({ label, emoji, onClick }: EmojiButtonProps) => (
	<motion.div layout className="relative size-10 max-sm:size-11">
		<motion.button
			layout
			className="inline-flex relative justify-center items-center p-1 text-xl leading-6 align-middle bg-transparent rounded-full transition-colors ease-in-out size-full font-emoji sm:text-2xl duration-600 hover:bg-gray-200 active:bg-blue-500 active:duration-0"
			type="button"
			aria-label={label}
			onClick={onClick}
		>
			{emoji}
		</motion.button>
	</motion.div>
);

export const Toolbar = ({
	data,
	onOptimisticComment,
	onCommentSuccess,
	disableComments,
	disableReactions,
	onWriteComment,
}: ToolbarProps) => {
	const user = useCurrentUser();
	const [showAuthOverlay, setShowAuthOverlay] = useState(false);
	const canComment = !disableComments;
	const canReact = !disableReactions;

	const handleEmojiClick = (emoji: string) => {
		handleEmojiReaction({
			emoji,
			canReact,
			user,
			onRequireAuth: () => setShowAuthOverlay(true),
			onReact: async (chosenEmoji, authedUser) => {
				const videoElement = document.querySelector(
					"video",
				) as HTMLVideoElement;
				const currentTime = data.isScreenshot
					? null
					: videoElement?.currentTime || 0;
				const optimisticComment: CommentType = {
					id: `temp-${Date.now()}` as Comment.CommentId,
					authorId: authedUser.id,
					authorName: authedUser.name,
					authorImage: authedUser.imageUrl,
					content: chosenEmoji,
					createdAt: new Date(),
					videoId: data.id,
					parentCommentId: "" as Comment.CommentId,
					type: "emoji",
					timestamp: currentTime,
					updatedAt: new Date(),
					mediaKey: null,
					mediaDuration: null,
					mediaMeta: null,
					sending: true,
				};

				onOptimisticComment?.(optimisticComment);

				try {
					const newCommentData = await newComment({
						content: chosenEmoji,
						videoId: data.id,
						authorImage: authedUser.imageUrl,
						parentCommentId: "" as Comment.CommentId,
						type: "emoji",
						timestamp: currentTime,
					});
					startTransition(() => {
						onCommentSuccess?.(newCommentData);
					});
				} catch (error) {
					console.error("Error posting comment:", error);
					toast.error("Couldn't add your reaction. Please try again.");
				}
			},
		});
	};

	useEffect(() => {
		if (!canComment || !onWriteComment) return;

		const handleKeyPress = (event: KeyboardEvent) => {
			if (
				event.key.toLowerCase() !== "c" ||
				event.metaKey ||
				event.ctrlKey ||
				event.altKey ||
				event.shiftKey ||
				(event.target instanceof HTMLElement &&
					event.target.closest(
						"input, textarea, select, [contenteditable], dialog[open]",
					))
			)
				return;
			event.preventDefault();
			onWriteComment();
		};
		window.addEventListener("keydown", handleKeyPress);
		return () => window.removeEventListener("keydown", handleKeyPress);
	}, [canComment, onWriteComment]);

	if (!canComment && !canReact) {
		return null;
	}

	return (
		<>
			<motion.div layout className="flex w-fit max-w-full items-center">
				<AnimatePresence initial={false} mode="popLayout">
					<motion.div
						layout
						key="toolbar"
						initial={{ scale: 0.9 }}
						animate={{ scale: 1 }}
						exit={{ scale: 0.9 }}
						transition={{ duration: 0.2, ease: "easeInOut" }}
						className="flex flex-wrap items-center gap-2"
					>
						{canReact && (
							<div className="flex gap-2 flex-wrap items-center">
								{REACTIONS.map((reaction) => (
									<EmojiButton
										key={reaction.emoji}
										emoji={reaction.emoji}
										label={reaction.label}
										onClick={() => handleEmojiClick(reaction.emoji)}
									/>
								))}
							</div>
						)}

						{canReact && canComment && (
							<motion.div className="hidden sm:block w-px bg-gray-5 h-4" />
						)}

						{canComment && (
							<div className="max-sm:hidden">
								<MotionButton
									onClick={onWriteComment}
									variant="dark"
									layout="position"
									kbd="c"
									size="sm"
									className="mx-auto w-fit"
								>
									Comment
								</MotionButton>
							</div>
						)}
					</motion.div>
				</AnimatePresence>
			</motion.div>

			<AuthOverlay
				isOpen={showAuthOverlay}
				onClose={() => setShowAuthOverlay(false)}
			/>
		</>
	);
};
