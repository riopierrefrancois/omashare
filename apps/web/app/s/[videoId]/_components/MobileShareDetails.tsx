import { X } from "lucide-react";
import { type ComponentProps, useEffect, useId, useRef, useState } from "react";
import { Sidebar } from "./Sidebar";

export function MobileShareDetails(props: ComponentProps<typeof Sidebar>) {
	const dialog = useRef<HTMLDialogElement>(null);
	const headingId = useId();
	const [opened, setOpened] = useState(false);
	const label = props.hasSummary ? "Summary" : "Transcript";

	useEffect(() => {
		if (!opened) return;
		const desktop = window.matchMedia("(min-width: 640px)");
		const closeOnDesktop = () => {
			if (desktop.matches && dialog.current?.open) dialog.current.close();
		};
		desktop.addEventListener("change", closeOnDesktop);
		return () => desktop.removeEventListener("change", closeOnDesktop);
	}, [opened]);

	return (
		<div className="ml-auto sm:hidden">
			<button
				type="button"
				aria-haspopup="dialog"
				className="h-11 rounded-xl bg-[var(--share-accent-soft)] px-3.5 text-sm font-medium"
				onClick={() => {
					setOpened(true);
					dialog.current?.showModal();
				}}
			>
				{label}
			</button>
			<dialog
				ref={dialog}
				aria-labelledby={headingId}
				className="fixed inset-x-0 top-auto bottom-0 m-0 w-full max-w-none rounded-t-2xl border-0 bg-white pb-[env(safe-area-inset-bottom)] text-[var(--share-ink)] backdrop:bg-black/35"
			>
				<div className="flex items-center justify-between px-4 pt-2">
					<h2 id={headingId} className="text-base font-semibold">
						{label}
					</h2>
					<form method="dialog">
						<button
							type="submit"
							aria-label={`Close ${label.toLowerCase()}`}
							className="grid size-11 place-items-center rounded-lg hover:bg-gray-3"
						>
							<X size={20} aria-hidden />
						</button>
					</form>
				</div>
				{opened && (
					<Sidebar
						{...props}
						onSeek={(time) => {
							props.onSeek?.(time);
							dialog.current?.close();
						}}
					/>
				)}
			</dialog>
		</div>
	);
}
