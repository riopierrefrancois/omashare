export interface ReactionDefinition {
	emoji: string;
	label: string;
}

export const PINNED_REACTIONS = [
	{ emoji: "👍", label: "thumbs up" },
	{ emoji: "♥", label: "heart" },
] satisfies ReactionDefinition[];

export const REACTIONS: readonly ReactionDefinition[] = [
	...PINNED_REACTIONS,
	{
		emoji: "😂",
		label: "joy",
	},
	{
		emoji: "😍",
		label: "love",
	},
	{
		emoji: "😮",
		label: "wow",
	},
	{
		emoji: "🙌",
		label: "yay",
	},
	{
		emoji: "👎",
		label: "down",
	},
];

export interface HandleEmojiReactionParams<TUser> {
	emoji: string;
	canReact: boolean;
	user: TUser | null | undefined;
	onRequireAuth: () => void;
	onReact: (emoji: string, user: TUser) => void | Promise<void>;
}

export function handleEmojiReaction<TUser>({
	emoji,
	canReact,
	user,
	onRequireAuth,
	onReact,
}: HandleEmojiReactionParams<TUser>): void {
	if (!canReact) return;
	if (!user) {
		onRequireAuth();
		return;
	}
	void onReact(emoji, user);
}
