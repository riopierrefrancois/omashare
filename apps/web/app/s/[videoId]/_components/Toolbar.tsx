import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@cap/ui";
// type-only on purpose: a value import of @cap/web-domain drags the whole
// effect runtime (~250 KB gz) into the share page's entry chunk. The branded
// ids carry no constraints, so plain casts replace `.make()` losslessly.
import type { Comment } from "@cap/web-domain";
import { startTransition, useEffect, useState } from "react";
import { toast } from "sonner";
import { newComment } from "@/actions/videos/new-comment";
import { useCurrentUser } from "@/app/Layout/AuthContext";
import type { CommentType } from "../Share";
import type { VideoData } from "../types";
import { AuthOverlay } from "./AuthOverlayLazy";
import { ReactionCounts } from "./comments/ReactionCounts";
import { handleEmojiReaction, REACTIONS } from "./toolbar-reactions";

// million-ignore
interface ToolbarProps {
	data: VideoData;
	comments: CommentType[];
	onOptimisticComment?: (comment: CommentType) => void;
	onCommentSuccess?: (comment: CommentType) => void;
	disableComments?: boolean;
	disableReactions?: boolean;
	onWriteComment?: () => void;
}

export const Toolbar = ({
	data,
	comments,
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
			onReact: (chosenEmoji, authedUser) =>
				startTransition(async () => {
					const videoElement = document.querySelector(
						"video",
					) as HTMLVideoElement;
					const currentTime = data.isScreenshot
						? null
						: videoElement?.currentTime || 0;
					const optimisticComment: CommentType = {
						id: `temp-${crypto.randomUUID()}` as Comment.CommentId,
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
							onCommentSuccess?.({
								...newCommentData,
								clientKey: optimisticComment.id,
							});
						});
					} catch (error) {
						console.error("Error posting comment:", error);
						toast.error("Couldn't add your reaction. Please try again.");
					}
				}),
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

	if (!canReact) return null;

	return (
		<>
			<div className="flex flex-wrap items-center gap-2">
				<ReactionCounts comments={comments} onReact={handleEmojiClick} />
				<DropdownMenu modal={false}>
					<DropdownMenuTrigger asChild>
						<button
							type="button"
							className="h-10 shrink-0 rounded-xl px-3 text-sm text-[#767676] hover:bg-gray-3"
						>
							+ React
						</button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="start" sideOffset={6}>
						{REACTIONS.map(({ emoji, label }) => (
							<DropdownMenuItem
								key={emoji}
								onSelect={() => handleEmojiClick(emoji)}
							>
								<span className="mr-2 font-emoji" aria-hidden>
									{emoji}
								</span>{" "}
								{label}
							</DropdownMenuItem>
						))}
					</DropdownMenuContent>
				</DropdownMenu>
			</div>

			<AuthOverlay
				isOpen={showAuthOverlay}
				onClose={() => setShowAuthOverlay(false)}
			/>
		</>
	);
};
