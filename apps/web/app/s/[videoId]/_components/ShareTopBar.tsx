"use client";

import { buildEnv, NODE_ENV } from "@cap/env";
import { Check, Clock, Copy, Link2 } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";
import type { ShareBrand } from "@/lib/share-branding";
import {
	copyRichVideoLink,
	videoPreviewImageUrl,
} from "@/lib/video-share-clipboard";
import { usePublicEnv } from "@/utils/public-env";

export function ShareTopBar({
	brand,
	title,
	videoId,
	customDomain,
	domainVerified,
}: {
	brand: ShareBrand;
	title: string;
	videoId: string;
	customDomain: string | null;
	domainVerified: boolean;
}) {
	const { webUrl } = usePublicEnv();
	const [linkCopied, setLinkCopied] = useState(false);
	const [showCopyOptions, setShowCopyOptions] = useState(false);
	const [capturedTime, setCapturedTime] = useState(0);
	const shareUrl = (() => {
		if (
			(NODE_ENV === "development" || buildEnv.NEXT_PUBLIC_IS_CAP) &&
			customDomain &&
			domainVerified
		) {
			return `https://${customDomain}/s/${videoId}`;
		}
		return `${webUrl}/s/${videoId}`;
	})();

	useEffect(() => {
		if (!showCopyOptions) return;
		const handler = (e: MouseEvent) => {
			if (
				e.target instanceof Element &&
				e.target.closest("[data-copy-link-control]")
			) {
				return;
			}
			setShowCopyOptions(false);
		};
		document.addEventListener("mousedown", handler);
		return () => document.removeEventListener("mousedown", handler);
	}, [showCopyOptions]);
	const formatTimestamp = (seconds: number): string => {
		const h = Math.floor(seconds / 3600);
		const m = Math.floor((seconds % 3600) / 60);
		const s = seconds % 60;
		if (h > 0)
			return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
		return `${m}:${String(s).padStart(2, "0")}`;
	};

	const copyShareLink = (url: string) =>
		copyRichVideoLink({
			url,
			title: title || "Video recording",
			previewImageUrl: videoPreviewImageUrl(webUrl, videoId),
		});

	const handleCopyClick = () => {
		const video = document.querySelector("video");
		const currentTime = video ? Math.floor(video.currentTime) : 0;

		if (currentTime > 3) {
			setCapturedTime(currentTime);
			setShowCopyOptions(true);
		} else {
			copyShareLink(shareUrl);
			setLinkCopied(true);
			setTimeout(() => setLinkCopied(false), 2000);
		}
	};

	const handleCopyLink = (withTimestamp: boolean) => {
		const link = withTimestamp ? `${shareUrl}?t=${capturedTime}` : shareUrl;
		copyShareLink(link);
		setShowCopyOptions(false);
		setLinkCopied(true);
		setTimeout(() => setLinkCopied(false), 2000);
	};

	return (
		<header className="shrink-0 border-b border-gray-5 bg-white">
			<div className="mx-auto flex h-[52px] max-w-[1240px] items-center gap-2 px-3.5 sm:h-[60px] sm:gap-2.5 sm:px-6">
				<div className="flex min-w-0 flex-1 items-center gap-2 text-[17px] font-bold sm:text-lg">
					{brand.logo && (
						<Image
							src={brand.logo}
							alt=""
							width={28}
							height={28}
							unoptimized
							className="size-[26px] shrink-0 object-contain sm:size-7"
						/>
					)}
					{brand.name && <span className="truncate">{brand.name}</span>}
				</div>
				<div className="relative shrink-0" data-copy-link-control>
					<button
						type="button"
						aria-label="Copy link"
						aria-expanded={showCopyOptions}
						onClick={handleCopyClick}
						className="flex size-11 items-center justify-center gap-1.5 rounded-xl border border-gray-5 bg-white text-sm font-medium hover:bg-gray-2 sm:h-10 sm:w-auto sm:rounded-[10px] sm:px-3.5"
					>
						{linkCopied ? (
							<Check size={16} aria-hidden />
						) : (
							<Link2 size={16} aria-hidden />
						)}
						<span className="hidden sm:inline">
							{linkCopied ? "Copied" : "Copy link"}
						</span>
					</button>
					{showCopyOptions && (
						<div className="absolute right-0 top-full z-50 mt-1 min-w-full w-max overflow-hidden rounded-lg border border-gray-6 bg-white shadow-lg">
							<button
								type="button"
								className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-12 transition-colors hover:bg-gray-3"
								onClick={() => handleCopyLink(false)}
							>
								<Copy className="w-3.5 h-3.5 shrink-0" />
								Copy link
							</button>
							<button
								type="button"
								className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-12 transition-colors hover:bg-gray-3"
								onClick={() => handleCopyLink(true)}
							>
								<Clock className="w-3.5 h-3.5 shrink-0" />
								Copy link at {formatTimestamp(capturedTime)}
							</button>
						</div>
					)}
				</div>
				{brand.websiteUrl && (
					<a
						href={brand.websiteUrl}
						className="hidden h-10 min-w-0 items-center rounded-[10px] bg-[var(--share-accent)] px-4 text-sm font-semibold !text-white sm:flex"
					>
						<span className="truncate">Visit {brand.websiteLabel}</span>
					</a>
				)}
			</div>
		</header>
	);
}
