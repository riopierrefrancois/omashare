import clsx from "clsx";

export function VideoLoadingSpinner({ className }: { className?: string }) {
	return (
		<span
			aria-hidden="true"
			className={clsx(
				"inline-block shrink-0 rounded-full border-2 border-current border-r-transparent motion-safe:animate-spin",
				className,
			)}
		/>
	);
}
