import clsx from "clsx";
import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import { useState } from "react";
import { useCurrentUser } from "@/app/Layout/AuthContext";
import type { VideoData } from "../types";
import type { SummaryEditingState } from "./tabs/SummaryEditor";

const importSummary = () => import("./tabs/Summary");
const importTranscript = () => import("./tabs/Transcript");
const Summary = dynamic(() => importSummary().then((m) => m.Summary));
const Transcript = dynamic(() => importTranscript().then((m) => m.Transcript));

const tabs = [
	{ id: "summary", label: "Summary", prefetch: importSummary },
	{ id: "transcript", label: "Transcript", prefetch: importTranscript },
] as const;

type Tab = (typeof tabs)[number]["id"];

export function Sidebar({
	data,
	hasSummary,
	hasTranscript,
	isSummaryDisabled,
	areChaptersDisabled,
	aiData,
	aiGenerationEnabled,
	onSeek,
	onCollapse,
}: {
	data: VideoData;
	hasSummary: boolean;
	hasTranscript: boolean;
	isSummaryDisabled?: boolean;
	areChaptersDisabled?: boolean;
	aiData?: ComponentProps<typeof Summary>["initialAiData"];
	aiGenerationEnabled?: boolean;
	onSeek?: (time: number) => void;
	onCollapse?: () => void;
}) {
	const user = useCurrentUser();
	const [selected, setSelected] = useState<Tab>();
	const [editing, setEditing] = useState<SummaryEditingState>("clean");
	const available = tabs.filter(({ id }) =>
		id === "summary" ? hasSummary : hasTranscript,
	);
	const active = available.find(({ id }) => id === selected) ?? available[0];
	if (!active) return null;

	const canLeave = () =>
		active.id !== "summary" ||
		(editing !== "saving" &&
			(editing !== "dirty" ||
				window.confirm("Discard your unsaved summary and chapter changes?")));

	return (
		<div className="flex max-h-[75svh] flex-col overflow-hidden rounded-xl bg-white p-3 shadow-sm">
			<div className="flex shrink-0 rounded-xl bg-gray-2 p-1">
				{available.length === 1 ? (
					<h2 className="flex-1 rounded-lg px-5 py-2.5 text-sm font-medium">
						{active.label}
					</h2>
				) : (
					available.map(({ id, label, prefetch }) => (
						<button
							type="button"
							key={id}
							aria-pressed={active.id === id}
							onClick={() => {
								if (active.id === id || !canLeave()) return;
								setEditing("clean");
								setSelected(id);
							}}
							onPointerEnter={() => void prefetch()}
							onFocus={() => void prefetch()}
							className={clsx(
								"flex-1 rounded-lg px-5 py-2.5 text-sm font-medium hover:bg-gray-1",
								active.id === id && "bg-white shadow-sm",
							)}
						>
							{label}
						</button>
					))
				)}
				{onCollapse && (
					<button
						type="button"
						aria-label="Hide sidebar"
						title="Hide sidebar"
						onClick={() => {
							if (canLeave()) onCollapse();
						}}
						className="hidden shrink-0 rounded-lg px-3 text-gray-10 hover:bg-white lg:block"
					>
						<span aria-hidden>›</span>
					</button>
				)}
			</div>
			<div className="min-h-0 flex-1 overflow-auto">
				{active.id === "summary" ? (
					<Summary
						videoId={data.id}
						ownerIsPro={data.owner.isPro}
						isOwner={user?.id === data.owner.id}
						transcriptionStatus={data.transcriptionStatus}
						duration={data.duration}
						onEditingStateChange={setEditing}
						onSeek={onSeek}
						isSummaryDisabled={isSummaryDisabled}
						areChaptersDisabled={areChaptersDisabled}
						initialAiData={aiData}
						aiGenerationEnabled={aiGenerationEnabled}
					/>
				) : (
					<Transcript data={data} onSeek={onSeek} />
				)}
			</div>
		</div>
	);
}
