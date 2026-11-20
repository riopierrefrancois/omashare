import type { CommentType } from "../../Share";

export function ReactionCounts({ comments }: { comments: CommentType[] }) {
	const reactions = new Map<string, string[]>();
	for (const comment of comments) {
		if (comment.type !== "emoji") continue;
		const name = comment.authorName ?? comment.guestName ?? "Guest";
		const names = reactions.get(comment.content);
		if (names) names.push(name);
		else reactions.set(comment.content, [name]);
	}

	if (reactions.size === 0) return null;

	return (
		<ul aria-label="Reactions" className="flex flex-wrap justify-center gap-2">
			{Array.from(reactions, ([emoji, names]) => (
				<li
					key={emoji}
					title={names.join(", ")}
					className="rounded-full border border-gray-5 bg-white px-2 py-0.5 text-sm text-gray-11"
				>
					<span className="font-emoji">{emoji}</span> {names.length}
				</li>
			))}
		</ul>
	);
}
