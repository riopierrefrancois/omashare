import type { CommentType } from "../../Share";
import { PINNED_REACTIONS, REACTIONS } from "../toolbar-reactions";

export function ReactionCounts({
	comments,
	onReact,
}: {
	comments: CommentType[];
	onReact: (emoji: string) => void;
}) {
	const reactions = new Map<string, string[]>(
		PINNED_REACTIONS.map(({ emoji }) => [emoji, []]),
	);
	for (const comment of comments) {
		if (comment.type !== "emoji") continue;
		const name = comment.authorName ?? comment.guestName ?? "Guest";
		const names = reactions.get(comment.content);
		if (names) names.push(name);
		else reactions.set(comment.content, [name]);
	}

	return (
		<ul aria-label="Reactions" className="flex flex-wrap gap-2">
			{Array.from(reactions, ([emoji, names]) => {
				const label =
					REACTIONS.find((reaction) => reaction.emoji === emoji)?.label ??
					emoji;
				return (
					<li key={emoji}>
						<button
							type="button"
							aria-label={`React with ${label}, ${names.length}`}
							title={names.length ? names.join(", ") : undefined}
							onClick={() => onReact(emoji)}
							className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-gray-5 bg-white px-3 text-sm text-gray-12 hover:bg-gray-3"
						>
							<span className="font-emoji" aria-hidden>
								{emoji}
							</span>{" "}
							{names.length}
						</button>
					</li>
				);
			})}
		</ul>
	);
}
