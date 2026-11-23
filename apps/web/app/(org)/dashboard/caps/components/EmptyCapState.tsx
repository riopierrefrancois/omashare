"use client";

import { Upload } from "lucide-react";
import { UploadCapButton } from "./UploadCapButton";

interface EmptyCapStateProps {
	userName?: string;
}

// Browser recording stays reachable from Ctrl K (/dashboard/caps/record).
export const EmptyCapState: React.FC<EmptyCapStateProps> = () => {
	return (
		<div className="flex flex-col gap-3 items-center px-6 py-16 text-center rounded-2xl border border-dashed border-gray-5">
			<svg
				width="28"
				height="28"
				viewBox="0 0 18 18"
				aria-hidden="true"
				className="text-gray-9"
			>
				<rect
					x="1"
					y="1"
					width="16"
					height="16"
					rx="4"
					fill="none"
					stroke="currentColor"
					strokeWidth="1.5"
				/>
				<path d="M7 5.5v7l5.5-3.5z" fill="currentColor" />
			</svg>
			<div className="flex flex-col gap-1 items-center">
				<p className="text-base font-medium text-gray-12">No videos yet</p>
				<p className="max-w-sm text-sm text-gray-10 text-pretty">
					Upload a video, or press Share link in Omacut, Omareel or Omaedit.
				</p>
			</div>
			<UploadCapButton
				renderTrigger={(onClick) => (
					<button
						type="button"
						onClick={onClick}
						className="inline-flex gap-2 items-center px-3.5 mt-1 h-10 text-sm font-medium rounded-[10px] border border-gray-5 hover:bg-gray-3"
					>
						<Upload className="size-4" aria-hidden="true" /> Upload
					</button>
				)}
			/>
		</div>
	);
};
