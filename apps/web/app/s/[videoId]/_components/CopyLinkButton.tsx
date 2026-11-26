"use client";

import clsx from "clsx";
import { Check, Clock, Copy, Link2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
	copyRichVideoLink,
	videoPreviewImageUrl,
} from "@/lib/video-share-clipboard";
import { usePublicEnv } from "@/utils/public-env";

const formatTimestamp = (seconds: number): string => {
	const h = Math.floor(seconds / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	const s = seconds % 60;
	if (h > 0)
		return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
	return `${m}:${String(s).padStart(2, "0")}`;
};

export function CopyLinkButton({
	shareUrl,
	title,
	videoId,
	className,
}: {
	shareUrl: string;
	title: string;
	videoId: string;
	className?: string;
}) {
	const { webUrl } = usePublicEnv();
	const [linkCopied, setLinkCopied] = useState(false);
	const [showCopyOptions, setShowCopyOptions] = useState(false);
	const [capturedTime, setCapturedTime] = useState(0);
	const controlRef = useRef<HTMLDivElement>(null);
	const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		if (!showCopyOptions) return;
		const handler = (e: MouseEvent) => {
			if (e.target instanceof Node && controlRef.current?.contains(e.target))
				return;
			setShowCopyOptions(false);
		};
		document.addEventListener("mousedown", handler);
		return () => document.removeEventListener("mousedown", handler);
	}, [showCopyOptions]);

	useEffect(
		() => () => {
			if (copiedTimer.current) clearTimeout(copiedTimer.current);
		},
		[],
	);

	const copy = (url: string) => {
		copyRichVideoLink({
			url,
			title: title || "Video recording",
			previewImageUrl: videoPreviewImageUrl(webUrl, videoId),
		});
		setLinkCopied(true);
		if (copiedTimer.current) clearTimeout(copiedTimer.current);
		copiedTimer.current = setTimeout(() => setLinkCopied(false), 2000);
	};

	const handleClick = () => {
		const video = document.querySelector("video");
		const currentTime = video ? Math.floor(video.currentTime) : 0;
		if (currentTime > 3) {
			setCapturedTime(currentTime);
			setShowCopyOptions(true);
		} else {
			copy(shareUrl);
		}
	};

	const handleCopyOption = (withTimestamp: boolean) => {
		setShowCopyOptions(false);
		copy(withTimestamp ? `${shareUrl}?t=${capturedTime}` : shareUrl);
	};

	return (
		<div ref={controlRef} className={clsx("relative shrink-0", className)}>
			<button
				type="button"
				aria-expanded={showCopyOptions}
				onClick={handleClick}
				className="inline-flex h-10 items-center gap-1.5 rounded-[10px] border-[1.5px] border-[var(--share-accent)] bg-white px-3.5 text-sm font-medium text-[var(--share-accent-text)] transition-colors hover:bg-gray-2"
			>
				{linkCopied ? (
					<Check size={16} aria-hidden />
				) : (
					<Link2 size={16} aria-hidden />
				)}
				{linkCopied ? "Copied" : "Copy link"}
			</button>
			{showCopyOptions && (
				<div className="absolute right-0 top-full z-50 mt-1 w-max min-w-full overflow-hidden rounded-lg border border-gray-6 bg-white shadow-lg">
					<button
						type="button"
						className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-12 transition-colors hover:bg-gray-3"
						onClick={() => handleCopyOption(false)}
					>
						<Copy className="size-3.5 shrink-0" aria-hidden />
						Copy link
					</button>
					<button
						type="button"
						className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-12 transition-colors hover:bg-gray-3"
						onClick={() => handleCopyOption(true)}
					>
						<Clock className="size-3.5 shrink-0" aria-hidden />
						Copy link at {formatTimestamp(capturedTime)}
					</button>
				</div>
			)}
		</div>
	);
}
