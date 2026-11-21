"use client";

import type { videos as videosSchema } from "@cap/database/schema";
import type { VideoMetadata } from "@cap/database/types";
import type { SpaceRuleSource, ViewerSettingKey } from "@cap/web-backend";
import type { ImageUpload, Video } from "@cap/web-domain";
import { faBoxArchive } from "@fortawesome/free-solid-svg-icons/faBoxArchive";
import clsx from "clsx";
import { Effect, Exit } from "effect";
import { AnimatePresence } from "framer-motion";
import { Search, Upload } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { FontAwesomeIcon } from "@/components/FontAwesomeIcon";
import {
	type SeededThumbnails,
	SeededThumbnailsProvider,
} from "@/components/VideoThumbnail";
import { DEFAULT_DASHBOARD_PAGE_SIZE } from "@/lib/dashboard-page-size";
import { useEffectMutation, useRpcClient } from "@/lib/EffectRuntime";
import { parsePageParam } from "@/lib/page-param";
import { useVideosAnalyticsQuery } from "@/lib/Queries/Analytics";
import {
	ArchiveDoodle,
	libraryDoodleHost,
} from "../_components/library-doodles";
import { useDashboardContext } from "../Contexts";
import {
	NewFolderDialog,
	SelectedCapsBar,
	UploadPlaceholderCard,
} from "./components";
import { CapCard } from "./components/CapCard/CapCard";
import { CapGridItem } from "./components/CapGridItem";
import {
	CapListHeader,
	listControlClass,
	PageSizeSelect,
} from "./components/CapListHeader";
import { CapPagination } from "./components/CapPagination";
import { DragHint } from "./components/DragHint";
import { EmptyCapState } from "./components/EmptyCapState";
import type { FolderDataType } from "./components/Folder";
import { FoldersSection } from "./components/FoldersSection";
import { UploadCapButton } from "./components/UploadCapButton";
import { useArchiveCaps, useLeavingCaps } from "./components/useArchiveCaps";
import { useCapSelection } from "./components/useCapSelection";
import { useCapsMoved } from "./components/useCapsMoved";
import { useUploadingStatus } from "./UploadingContext";

export type VideoData = {
	id: Video.VideoId;
	ownerId: string;
	name: string;
	createdAt: Date;
	public: boolean;
	totalComments: number;
	totalReactions: number;
	foldersData: FolderDataType[];
	sharedOrganizations: {
		id: string;
		name: string;
		iconUrl?: ImageUpload.ImageUrl | null;
	}[];
	sharedSpaces?: {
		id: string;
		name: string;
		isOrg: boolean;
		organizationId: string;
		iconUrl?: ImageUpload.ImageUrl | null;
		settings?: Partial<Record<ViewerSettingKey, boolean>> | null;
		hasPassword?: boolean;
	}[];
	ownerName: string;
	metadata?: VideoMetadata;
	source: typeof videosSchema.$inferSelect.source;
	isScreenshot: boolean;
	hasPassword: boolean;
	hasInheritedPassword?: boolean;
	inheritedPasswordSources?: SpaceRuleSource[];
	inheritedSpaceSettings?: Partial<Record<ViewerSettingKey, SpaceRuleSource[]>>;
	hasActiveUpload: boolean;
	settings?: Partial<Record<ViewerSettingKey, boolean>> | null;
	archivedAt?: Date | null;
}[];

export const Caps = ({
	data,
	count,
	analyticsEnabled,
	folders,
	thumbnails,
	pageSize = DEFAULT_DASHBOARD_PAGE_SIZE,
	archivedCount = 0,
	view = "library",
	search = "",
}: {
	data: VideoData;
	count: number;
	folders: FolderDataType[];
	analyticsEnabled: boolean;
	thumbnails?: SeededThumbnails;
	pageSize?: number;
	archivedCount?: number;
	view?: "library" | "archived";
	search?: string;
}) => {
	const router = useRouter();
	const params = useSearchParams();
	const page = parsePageParam(params.get("page"));
	const { user } = useDashboardContext();
	const isArchivedView = view === "archived";
	const searchRef = useRef<HTMLInputElement>(null);
	const [openNewFolderDialog, setOpenNewFolderDialog] = useState(false);
	const totalPages = Math.ceil(count / pageSize);
	const moveLocation = { type: "personal" } as const;

	const [isUploading, uploadingCapId] = useUploadingStatus();
	const listedVideos = useMemo(
		() =>
			!isArchivedView && isUploading && uploadingCapId
				? data.filter((video) => video.id !== uploadingCapId)
				: data,
		[data, isArchivedView, isUploading, uploadingCapId],
	);
	const leavingCaps = useLeavingCaps(listedVideos);
	const visibleVideos = leavingCaps.present;
	const pageIds = useMemo(
		() => visibleVideos.map((video) => video.id),
		[visibleVideos],
	);
	const selectAllView = useMemo(
		() =>
			isArchivedView
				? ({ type: "archived" } as const)
				: ({ type: "personal" } as const),
		[isArchivedView],
	);
	const selection = useCapSelection({
		pageIds,
		totalCount: search ? pageIds.length : count,
		view: selectAllView,
	});
	const selectedCaps = selection.selected;
	const setSelectedCaps = selection.setSelected;

	useCapsMoved((ids) =>
		setSelectedCaps((current) => current.filter((id) => !ids.includes(id))),
	);

	const archiveCaps = useArchiveCaps({
		onDone: (ids) =>
			setSelectedCaps((current) => current.filter((id) => !ids.includes(id))),
		onLeave: leavingCaps.leave,
		onReturn: leavingCaps.restore,
	});
	const shownCount = count - leavingCaps.leavingCount;
	const shownArchivedCount =
		archivedCount + (isArchivedView ? 0 : leavingCaps.leavingCount);

	const anyCapSelected = selectedCaps.length > 0;

	const analyticsQuery = useVideosAnalyticsQuery(
		data.map((video) => video.id),
		analyticsEnabled,
	);
	const analytics: Partial<Record<Video.VideoId, number>> =
		analyticsQuery.data || {};
	const isLoadingAnalytics = analyticsEnabled && analyticsQuery.isLoading;

	const rpc = useRpcClient() as {
		VideoDelete: (id: Video.VideoId) => Effect.Effect<void, unknown, never>;
	};

	const { mutate: deleteCaps, isPending: isDeletingCaps } = useEffectMutation({
		mutationFn: Effect.fn(function* (ids: Video.VideoId[]) {
			if (ids.length === 0) return { success: 0 };

			const results = yield* Effect.all(
				ids.map((id) => rpc.VideoDelete(id).pipe(Effect.exit)),
				{ concurrency: 10 },
			);

			const successCount = results.filter(Exit.isSuccess).length;

			const errorCount = ids.length - successCount;

			if (successCount > 0 && errorCount > 0) {
				return { success: successCount, error: errorCount };
			} else if (successCount > 0) {
				return { success: successCount };
			} else {
				return yield* Effect.fail(
					new Error(
						`Failed to delete ${errorCount} video${errorCount === 1 ? "" : "s"}`,
					),
				);
			}
		}),
		onMutate: (ids: Video.VideoId[]) =>
			toast.loading(
				`Deleting ${ids.length} video${ids.length === 1 ? "" : "s"}...`,
			),
		onSuccess: (
			data: { success: number; error?: number },
			_ids: Video.VideoId[],
			toastId: string | number | undefined,
		) => {
			setSelectedCaps([]);
			router.refresh();
			if (data.error) {
				toast.success(
					`Successfully deleted ${data.success} video${
						data.success === 1 ? "" : "s"
					}, but failed to delete ${data.error} video${
						data.error === 1 ? "" : "s"
					}`,
					{ id: toastId },
				);
			} else {
				toast.success(
					`Successfully deleted ${data.success} video${
						data.success === 1 ? "" : "s"
					}`,
					{ id: toastId },
				);
			}
		},
		onError: (
			error: unknown,
			_ids: Video.VideoId[],
			toastId: string | number | undefined,
		) => {
			const message =
				error instanceof Error
					? error.message
					: "An error occurred while deleting videos";
			toast.error(message, { id: toastId });
		},
	});

	const { mutate: deleteCap, isPending: isDeletingCap } = useEffectMutation({
		mutationFn: Effect.fn(function* (id: Video.VideoId) {
			yield* rpc.VideoDelete(id);
		}),
		onSuccess: () => {
			toast.success("Video deleted successfully");
			router.refresh();
		},
		onError: (_error: unknown) => toast.error("Failed to delete video"),
	});

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (
				(e.key === "Delete" || e.key === "Backspace") &&
				selectedCaps.length > 0
			) {
				const active = document.activeElement;
				// Deleting is immediate and permanent, so the key only counts on the
				// page itself: not inside an open dialog (Move, Share), not while a
				// held key repeats, and not while the previous delete is running.
				// The shortcut skips the confirmation dialog, so it only acts on
				// Caps the viewer can see; "Select all" can reach thousands of
				// Caps across pages, which must go through the confirmed button.
				const pageIdSet = new Set<string>(pageIds);
				if (
					!e.repeat &&
					!isDeletingCaps &&
					selectedCaps.every((id) => pageIdSet.has(id)) &&
					!["INPUT", "TEXTAREA", "SELECT"].includes(active?.tagName || "") &&
					!(active instanceof HTMLElement && active.isContentEditable) &&
					!active?.closest('[role="dialog"], [role="alertdialog"]')
				) {
					if (e.key === "Backspace") {
						e.preventDefault();
					}

					deleteCaps(selectedCaps);
				}
			}
		};

		window.addEventListener("keydown", handleKeyDown);

		return () => {
			window.removeEventListener("keydown", handleKeyDown);
		};
	}, [selectedCaps, deleteCaps, isDeletingCaps, pageIds]);

	useEffect(() => {
		if (isArchivedView) return;
		const focusSearch = (event: KeyboardEvent) => {
			if (
				event.key !== "/" ||
				event.defaultPrevented ||
				event.metaKey ||
				event.ctrlKey ||
				event.altKey ||
				(event.target instanceof HTMLElement &&
					event.target.closest(
						'input, textarea, select, [contenteditable], [role="dialog"], [role="alertdialog"]',
					))
			)
				return;
			event.preventDefault();
			searchRef.current?.focus();
		};
		window.addEventListener("keydown", focusSearch);
		return () => window.removeEventListener("keydown", focusSearch);
	}, [isArchivedView]);

	const archivedLink =
		!isArchivedView && shownArchivedCount > 0 ? (
			<Link
				href="/dashboard/caps/archived"
				className={clsx(listControlClass, "gap-2 px-3")}
			>
				<FontAwesomeIcon icon={faBoxArchive} className="size-3 text-gray-10" />
				<span>Archived</span>
				<span className="tabular-nums text-gray-10">
					{shownArchivedCount.toLocaleString("en-US")}
				</span>
			</Link>
		) : null;

	return (
		<div
			className={clsx(
				"flex relative flex-col w-full h-full",
				!isArchivedView && "mx-auto max-w-[1000px]",
			)}
		>
			{isArchivedView ? (
				<div className="mb-8">
					<p className="max-w-xl text-sm text-gray-10 text-pretty">
						Archived videos are hidden from My videos and your folders. Their
						links, comments and any spaces they are shared with keep working.
					</p>
				</div>
			) : (
				<>
					<NewFolderDialog
						open={openNewFolderDialog}
						onOpenChange={setOpenNewFolderDialog}
					/>
					<div className="mb-6 flex flex-wrap items-center gap-3">
						<h1 className="text-[28px] font-semibold tracking-[-0.02em]">
							My videos
						</h1>
						<span className="mr-auto font-mono text-sm text-gray-10">
							{shownCount}
						</span>
						<form
							action="/dashboard/caps"
							className="flex h-10 w-full items-center gap-2 rounded-[10px] border border-gray-5 px-3 focus-within:ring-2 focus-within:ring-blue-9 sm:w-[260px]"
						>
							<Search className="size-4 shrink-0 text-gray-10" aria-hidden />
							<input
								ref={searchRef}
								key={search}
								name="q"
								type="search"
								defaultValue={search}
								placeholder="Search your videos"
								aria-label="Search your videos"
								className="min-w-0 flex-1 bg-transparent text-sm outline-none"
							/>
							<kbd className="hidden rounded border border-gray-5 px-1.5 font-mono text-xs text-gray-11 sm:inline">
								/
							</kbd>
						</form>
						<button
							type="button"
							onClick={() => setOpenNewFolderDialog(true)}
							className="inline-flex h-10 shrink-0 items-center rounded-[10px] border border-gray-5 px-3.5 text-sm font-medium hover:bg-gray-3"
						>
							New folder
						</button>
						<UploadCapButton
							renderTrigger={(onClick) => (
								<button
									type="button"
									onClick={onClick}
									className="inline-flex h-10 items-center gap-2 rounded-[10px] bg-[#2959C4] px-4 text-sm font-semibold text-white hover:bg-[#244EAB]"
								>
									<Upload className="size-4" aria-hidden="true" /> Upload
								</button>
							)}
						/>
					</div>
					<FoldersSection
						title="Folders"
						scope="personal"
						folders={folders}
						canMove
						moveRootLabel="My videos"
					/>
				</>
			)}
			{!isArchivedView &&
				visibleVideos.length === 0 &&
				!isUploading &&
				(search ? (
					<p className="rounded-xl border border-gray-5 p-6 text-sm text-gray-11">
						No videos match your search.
					</p>
				) : (
					folders.length === 0 && <EmptyCapState />
				))}
			{isArchivedView && visibleVideos.length === 0 && (
				<div
					className={clsx(
						libraryDoodleHost,
						"flex flex-col gap-3 items-center px-6 py-12 text-center rounded-2xl border border-dashed animate-in fade-in border-gray-5 bg-gray-1",
					)}
				>
					<ArchiveDoodle />
					<div className="flex flex-col gap-1 items-center">
						<p className="text-base font-medium text-gray-12">
							Nothing archived
						</p>
						<p className="max-w-sm text-sm text-gray-10 text-pretty">
							Archive a video from its menu to tidy up My videos without
							deleting anything.
						</p>
					</div>
					<Link
						href="/dashboard/caps"
						className={clsx(listControlClass, "px-3 mt-1")}
					>
						Back to My videos
					</Link>
				</div>
			)}
			{visibleVideos.length === 0 && archivedLink && (
				<div className="flex justify-end mb-5">{archivedLink}</div>
			)}
			{(visibleVideos.length > 0 || (!isArchivedView && isUploading)) && (
				<>
					{isArchivedView ? (
						<CapListHeader
							title="Archived"
							count={shownCount}
							selectionState={selection.pageState}
							onToggleSelectAll={selection.togglePage}
							actions={<PageSizeSelect pageSize={pageSize} />}
						/>
					) : archivedLink ? (
						<div className="mb-5 flex justify-end">{archivedLink}</div>
					) : null}

					<SeededThumbnailsProvider value={thumbnails}>
						<div
							className={clsx(
								"grid relative gap-x-5 gap-y-6",
								isArchivedView
									? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
									: "grid-cols-[repeat(auto-fill,minmax(min(100%,260px),1fr))]",
							)}
						>
							{!isArchivedView && isUploading && (
								<UploadPlaceholderCard key={"upload-placeholder"} />
							)}
							<AnimatePresence
								initial={false}
								mode="popLayout"
								custom={leavingCaps.leaving}
							>
								{visibleVideos.map((video) => {
									const videoAnalytics = analytics[video.id];
									return (
										<CapGridItem
											key={video.id}
											id={video.id}
											layoutDependency={visibleVideos}
											returning={leavingCaps.returning.has(video.id)}
										>
											<CapCard
												key={video.id}
												cap={video}
												libraryCard={!isArchivedView}
												analytics={videoAnalytics ?? 0}
												onDelete={() => {
													if (selectedCaps.length > 0) {
														deleteCaps(selectedCaps);
													} else {
														deleteCap(video.id);
													}
												}}
												userId={user?.id}
												isLoadingAnalytics={isLoadingAnalytics}
												isSelected={selectedCaps.includes(video.id)}
												anyCapSelected={anyCapSelected}
												onSelectToggle={(options) =>
													selection.toggle(video.id, options)
												}
												selectedIds={selectedCaps}
												canMove={!isArchivedView}
												moveLocation={moveLocation}
												moveRootLabel="My videos"
												isArchived={isArchivedView}
												onArchiveToggle={() =>
													void archiveCaps.mutate({
														ids: [video.id],
														archived: !isArchivedView,
													})
												}
											/>
										</CapGridItem>
									);
								})}
							</AnimatePresence>
						</div>
					</SeededThumbnailsProvider>
				</>
			)}
			{(isArchivedView
				? data.length >= pageSize || page !== 1
				: totalPages > 1) && (
				<div className="mt-7">
					<CapPagination
						currentPage={page}
						totalPages={totalPages}
						hrefForPage={(target) => {
							const query = new URLSearchParams(params.toString());
							query.set("page", String(target));
							if (!isArchivedView) query.delete("limit");
							return `/dashboard/caps${isArchivedView ? "/archived" : ""}?${query}`;
						}}
					/>
				</div>
			)}
			<SelectedCapsBar
				selectedCaps={selectedCaps}
				setSelectedCaps={setSelectedCaps}
				deleteSelectedCaps={() => deleteCaps(selectedCaps)}
				isDeleting={isDeletingCaps || isDeletingCap}
				moveLocation={isArchivedView ? undefined : moveLocation}
				moveRootLabel={isArchivedView ? undefined : "My videos"}
				selection={selection}
				archive={{
					mode: isArchivedView ? "unarchive" : "archive",
					isPending: archiveCaps.isPending,
					onArchive: () =>
						void archiveCaps.mutate({
							ids: selectedCaps,
							archived: !isArchivedView,
						}),
				}}
			/>
			{!isArchivedView && (
				<DragHint caps="Drop on a folder to move, or on a space to share" />
			)}
		</div>
	);
};
