import { db } from "@cap/database";
import { comments } from "@cap/database/schema";
import type { Comment, Video } from "@cap/web-domain";
import { and, eq } from "drizzle-orm";

export async function replyParentError(
	parentCommentId: Comment.CommentId,
	videoId: Video.VideoId,
) {
	const [parent] = await db()
		.select({ parentCommentId: comments.parentCommentId })
		.from(comments)
		.where(and(eq(comments.id, parentCommentId), eq(comments.videoId, videoId)))
		.limit(1);
	if (!parent) return "Comment not found";
	if (parent.parentCommentId) return "You can only reply to a comment.";
}
