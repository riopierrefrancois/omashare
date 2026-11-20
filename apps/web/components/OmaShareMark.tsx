import clsx from "clsx";

export function OmaShareMark({
	className,
	compact = false,
}: {
	className?: string;
	compact?: boolean;
}) {
	return (
		<span
			className={clsx(
				"inline-flex shrink-0 items-center gap-2 font-mono text-base font-semibold tracking-tight",
				className,
			)}
		>
			<svg
				viewBox="0 0 18 18"
				className="size-[1.45em] text-[#2959C4] dark:text-[#7AA2F7]"
				aria-hidden="true"
			>
				<rect
					x="1"
					y="1"
					width="16"
					height="16"
					rx="4"
					fill="none"
					stroke="currentColor"
					strokeWidth="1.8"
				/>
				<path d="M7 5.5v7l5.5-3.5z" fill="currentColor" />
			</svg>
			<span className={compact ? "sr-only" : undefined}>omashare</span>
		</span>
	);
}
