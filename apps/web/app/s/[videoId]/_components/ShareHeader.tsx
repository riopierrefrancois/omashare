"use client";

import { buildEnv, NODE_ENV } from "@cap/env";
import {
	Button,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@cap/ui";
import type { ViewerSettingKey } from "@cap/web-backend";
import { getCustomThumbnailMetadata } from "@cap/web-backend/src/Storage/custom-thumbnail";
import { faChartSimple } from "@fortawesome/free-solid-svg-icons/faChartSimple";
import { faChevronDown } from "@fortawesome/free-solid-svg-icons/faChevronDown";
import { faEllipsis } from "@fortawesome/free-solid-svg-icons/faEllipsis";
import { faGear } from "@fortawesome/free-solid-svg-icons/faGear";
import { faLock } from "@fortawesome/free-solid-svg-icons/faLock";
import { faShare } from "@fortawesome/free-solid-svg-icons/faShare";
import { faTrash } from "@fortawesome/free-solid-svg-icons/faTrash";
import { skipToken, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import {
	Download,
	FolderInput,
	Globe2,
	ImageIcon,
	Lock,
	MousePointer2,
	Pencil,
	Users,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, use, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { editTitle } from "@/actions/videos/edit-title";
import type { VideoStatusResult } from "@/actions/videos/get-status";
import { useDashboardContext } from "@/app/(org)/dashboard/DashboardContext";
import type { Spaces } from "@/app/(org)/dashboard/dashboard-data";
import { useCurrentUser } from "@/app/Layout/AuthContext";
import { FontAwesomeIcon } from "@/components/FontAwesomeIcon";
import { SignedImageUrl } from "@/components/SignedImageUrl";
import { Tooltip } from "@/components/Tooltip";
import { formatClock } from "@/lib/player-time";
import type { ShareDashboardDestination } from "@/lib/share-dashboard-destination";
import { usePublicEnv } from "@/utils/public-env";
import type { VideoData } from "../types";
import { DashboardBackLink } from "./DashboardBackLink";
import { RelativeTime } from "./RelativeTime";
import { describeShareAudience } from "./share-audience";
import { useVideoDownload } from "./use-video-download";
import { fromNow } from "./utils/from-now";
import { VideoDownloadMenu } from "./VideoDownloadMenu";

/**
 * Off the header's critical path: brand SVGs and the embed snippet are dead
 * weight for the (many) viewers who never open the share sheet. Hovering the
 * button warms the chunk, so the click still feels instant.
 */
const importShareLinkDialog = () => import("./ShareLinkDialog");
const ShareLinkDialog = dynamic(importShareLinkDialog, { ssr: false });

/**
 * Same treatment for the rest of the header's interaction-only surfaces. The
 * owner dialogs and the upgrade modal (which carries the Rive animation
 * runtime) are mounted behind latches; the two RPC-backed pieces additionally
 * keep the Effect runtime chunk out of every plain page view.
 */
const importUpgradeModal = () =>
	import("@/components/UpgradeModal").then((m) => m.UpgradeModal);
const UpgradeModal = dynamic(importUpgradeModal, { ssr: false });
const SharingDialog = dynamic(
	() =>
		import("@/app/(org)/dashboard/caps/components/SharingDialog").then(
			(m) => m.SharingDialog,
		),
	{ ssr: false },
);
const MoveItemsDialog = dynamic(
	() =>
		import("@/app/(org)/dashboard/caps/components/MoveItemsDialog").then(
			(m) => m.MoveItemsDialog,
		),
	{ ssr: false },
);
const SettingsDialog = dynamic(
	() =>
		import("@/app/(org)/dashboard/caps/components/SettingsDialog").then(
			(m) => m.SettingsDialog,
		),
	{ ssr: false },
);
const PasswordDialog = dynamic(
	() =>
		import("@/app/(org)/dashboard/caps/components/PasswordDialog").then(
			(m) => m.PasswordDialog,
		),
	{ ssr: false },
);
const DeleteCapDialog = dynamic(() => import("./DeleteCapDialog"), {
	ssr: false,
});
const CallToActionDialog = dynamic(
	() =>
		import("./call-to-action/CallToActionDialog").then(
			(m) => m.CallToActionDialog,
		),
	{ ssr: false },
);
const CustomThumbnailDialog = dynamic(
	() => import("@/components/custom-thumbnail/CustomThumbnailDialog"),
	{ ssr: false },
);
/**
 * Shared by the heading and the rename field. Renaming is meant to read as a
 * caret appearing in the title, so both have to render the same glyphs at the
 * same size on the same baseline — the line heights are spelled out because a
 * bare `h1` and a bare `input` each pick up a different one from the base layer.
 */
const TITLE_TEXT_CLASS = "text-2xl leading-tight font-bold sm:text-[28px]";

const OWNER_DATE = new Intl.DateTimeFormat("en-US", {
	month: "short",
	day: "numeric",
	timeZone: "UTC",
});

const TITLE_PLACEHOLDER = "video title";

const ACTION_BAR_BUTTON_CLASS =
	"h-9 min-w-0 shrink-0 gap-1.5 rounded-[10px] bg-white px-2 text-sm sm:px-3";

export const ShareHeader = ({
	data,
	customDomain,
	domainVerified,
	allowedEmailDomain,
	allowLinkOverride = false,
	linkOpenToAnyone = false,
	sharedOrganizations = [],
	sharedSpaces = [],
	viewerCount = 0,
	spacesData = null,
	brandColor = null,
	canDownload = false,
	canMoveToFolder = false,
	hasEdits = false,
	views,
	dashboardDestination = null,
}: {
	data: VideoData;
	customDomain?: string | null;
	domainVerified?: boolean;
	allowedEmailDomain?: string | null;
	allowLinkOverride?: boolean;
	linkOpenToAnyone?: boolean;
	sharedOrganizations?: { id: string; name: string }[];
	viewerCount?: number;
	userOrganizations?: { id: string; name: string }[];
	sharedSpaces?: {
		id: string;
		name: string;
		iconUrl?: string;
		organizationId: string;
		settings?: Partial<Record<ViewerSettingKey, boolean>> | null;
		hasPassword?: boolean;
	}[];
	userSpaces?: {
		id: string;
		name: string;
		iconUrl?: string;
		organizationId: string;
		settings?: Partial<Record<ViewerSettingKey, boolean>> | null;
		hasPassword?: boolean;
	}[];
	spacesData?: Spaces[] | null;
	brandColor?: string | null;
	canDownload?: boolean;
	canMoveToFolder?: boolean;
	hasEdits?: boolean;
	views?: MaybePromise<number | null>;
	dashboardDestination?: ShareDashboardDestination | null;
}) => {
	const user = useCurrentUser();
	const { push, refresh } = useRouter();
	const queryClient = useQueryClient();
	const { data: videoStatus } = useQuery<VideoStatusResult>({
		queryKey: ["videoStatus", data.id],
		queryFn: skipToken,
	});
	const [moveDialogOpen, setMoveDialogOpen] = useState(false);
	const [moveDialogMounted, setMoveDialogMounted] = useState(false);
	const [isEditing, setIsEditing] = useState(false);
	const [displayTitle, setDisplayTitle] = useState(data.name);
	const [editValue, setEditValue] = useState(data.name);
	const [isTitleRevealing, setIsTitleRevealing] = useState(false);
	const [upgradeModalOpen, setUpgradeModalOpenRaw] = useState(false);
	const [isSharingDialogOpen, setIsSharingDialogOpenRaw] = useState(false);
	const [isShareLinkDialogOpen, setIsShareLinkDialogOpen] = useState(false);
	// Latched so each lazy chunk is only ever pulled in once, and so a dialog
	// keeps its exit animation instead of being torn out of the tree on close.
	const [shareLinkDialogMounted, setShareLinkDialogMounted] = useState(false);
	const [upgradeModalMounted, setUpgradeModalMounted] = useState(false);
	const [sharingDialogMounted, setSharingDialogMounted] = useState(false);
	const [settingsDialogMounted, setSettingsDialogMounted] = useState(false);
	const [passwordDialogMounted, setPasswordDialogMounted] = useState(false);
	const [deleteDialogMounted, setDeleteDialogMounted] = useState(false);
	const [ctaDialogMounted, setCtaDialogMounted] = useState(false);
	const [isCtaDialogOpen, setIsCtaDialogOpenRaw] = useState(false);
	const [thumbnailDialogMounted, setThumbnailDialogMounted] = useState(false);
	const [isThumbnailDialogOpen, setIsThumbnailDialogOpenRaw] = useState(false);
	const [isSettingsDialogOpen, setIsSettingsDialogOpenRaw] = useState(false);
	const [isPasswordDialogOpen, setIsPasswordDialogOpenRaw] = useState(false);
	const [isDeleteDialogOpen, setIsDeleteDialogOpenRaw] = useState(false);
	const setUpgradeModalOpen = (open: boolean) => {
		if (open) setUpgradeModalMounted(true);
		setUpgradeModalOpenRaw(open);
	};
	const setIsSharingDialogOpen = (open: boolean) => {
		if (open) setSharingDialogMounted(true);
		setIsSharingDialogOpenRaw(open);
	};
	const setIsSettingsDialogOpen = (open: boolean) => {
		if (open) setSettingsDialogMounted(true);
		setIsSettingsDialogOpenRaw(open);
	};
	const setIsPasswordDialogOpen = (open: boolean) => {
		if (open) setPasswordDialogMounted(true);
		setIsPasswordDialogOpenRaw(open);
	};
	const setIsDeleteDialogOpen = (open: boolean) => {
		if (open) setDeleteDialogMounted(true);
		setIsDeleteDialogOpenRaw(open);
	};
	const setIsCtaDialogOpen = (open: boolean) => {
		if (open) setCtaDialogMounted(true);
		setIsCtaDialogOpenRaw(open);
	};
	const setIsThumbnailDialogOpen = (open: boolean) => {
		if (open) setThumbnailDialogMounted(true);
		setIsThumbnailDialogOpenRaw(open);
	};
	const [passwordProtected, setPasswordProtected] = useState(
		Boolean(data.hasPassword),
	);
	const titleInputRef = useRef<HTMLInputElement>(null);
	const titleButtonRef = useRef<HTMLButtonElement>(null);
	/**
	 * The name a rename put on screen before the server had it. Held until the
	 * server agrees, so the effect below can't shimmer the stale title back in
	 * over the one the owner just typed.
	 */
	const pendingTitleRef = useRef<string | null>(null);
	const cancelTitleEditRef = useRef(false);
	const restoreTitleFocusRef = useRef(false);
	const titleSwapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
		null,
	);
	const titleRevealEndTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
		null,
	);

	const contextData = useDashboardContext();
	const contextSharedSpaces = contextData?.sharedSpaces || null;
	const effectiveSharedSpaces = contextSharedSpaces || sharedSpaces;

	const isOwner = user && user.id === data.owner.id;

	const { webUrl } = usePublicEnv();
	const { download, isDownloading } = useVideoDownload(data.id);

	const resolvedTitle = videoStatus?.name ?? data.name;
	const effectivePasswordProtected =
		passwordProtected || Boolean(data.hasInheritedPassword);

	useEffect(() => {
		setPasswordProtected(Boolean(data.hasPassword));
	}, [data.hasPassword]);

	useEffect(() => {
		if (isEditing) return;

		if (pendingTitleRef.current !== null) {
			// Hold the owner's own edit until the server echoes it back; anything
			// else arriving in the meantime is a value we already know is stale.
			if (resolvedTitle !== pendingTitleRef.current) return;
			pendingTitleRef.current = null;
		}

		if (resolvedTitle === displayTitle) return;

		const prefersReducedMotion =
			typeof window !== "undefined" &&
			window.matchMedia("(prefers-reduced-motion: reduce)").matches;

		if (prefersReducedMotion) {
			setDisplayTitle(resolvedTitle);
			return;
		}

		setIsTitleRevealing(true);
		if (titleSwapTimeoutRef.current) clearTimeout(titleSwapTimeoutRef.current);
		if (titleRevealEndTimeoutRef.current)
			clearTimeout(titleRevealEndTimeoutRef.current);

		titleSwapTimeoutRef.current = setTimeout(() => {
			setDisplayTitle(resolvedTitle);
		}, 160);
		titleRevealEndTimeoutRef.current = setTimeout(() => {
			setIsTitleRevealing(false);
		}, 1000);
	}, [resolvedTitle, displayTitle, isEditing]);

	useEffect(
		() => () => {
			if (titleSwapTimeoutRef.current)
				clearTimeout(titleSwapTimeoutRef.current);
			if (titleRevealEndTimeoutRef.current)
				clearTimeout(titleRevealEndTimeoutRef.current);
		},
		[],
	);

	const startEditing = () => {
		setEditValue(displayTitle);
		setIsEditing(true);
	};

	/**
	 * Opening the field focuses and selects it — clicking a title is a request to
	 * rename it, not to go hunting for the caret. Closing it hands focus back to
	 * the title, but only when the keyboard closed it: a click elsewhere has
	 * already chosen where focus should land.
	 */
	useEffect(() => {
		if (isEditing) {
			titleInputRef.current?.focus();
			titleInputRef.current?.select();
			return;
		}
		if (!restoreTitleFocusRef.current) return;
		restoreTitleFocusRef.current = false;
		titleButtonRef.current?.focus();
	}, [isEditing]);

	const setTitleEverywhere = (name: string) => {
		setDisplayTitle(name);
		queryClient.setQueryData<VideoStatusResult>(
			["videoStatus", data.id],
			(old) => (old ? { ...old, name } : old),
		);
	};

	const commitTitle = async () => {
		setIsEditing(false);
		const next = editValue.trim();
		if (next === "" || next === displayTitle) return;

		// The new name lands on the heading immediately and the write catches up
		// behind it. A rename that waits on a round-trip before showing anything
		// (and then announces itself with a toast) feels like a form submission,
		// not like editing the title in place.
		const previous = displayTitle;
		pendingTitleRef.current = next;
		setTitleEverywhere(next);

		try {
			await editTitle(data.id, next);
			refresh();
		} catch (error) {
			pendingTitleRef.current = null;
			setTitleEverywhere(previous);
			toast.error(
				error instanceof Error
					? error.message
					: "Failed to update title - please try again.",
			);
		}
	};

	// Blur is the only path that writes, so Enter and the click-away it causes
	// can't both fire the same rename.
	const handleTitleBlur = () => {
		if (cancelTitleEditRef.current) {
			cancelTitleEditRef.current = false;
			setEditValue(displayTitle);
			setIsEditing(false);
			return;
		}
		void commitTitle();
	};

	const handleTitleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
		if (event.key === "Enter" || event.key === "Escape") {
			event.preventDefault();
			cancelTitleEditRef.current = event.key === "Escape";
			restoreTitleFocusRef.current = true;
			titleInputRef.current?.blur();
		}
	};

	const getVideoLink = () => {
		if (
			(NODE_ENV === "development" || buildEnv.NEXT_PUBLIC_IS_CAP) &&
			customDomain &&
			domainVerified
		) {
			return `https://${customDomain}/s/${data.id}`;
		}
		return `${webUrl}/s/${data.id}`;
	};

	const openShareLinkDialog = () => {
		setShareLinkDialogMounted(true);
		setIsShareLinkDialogOpen(true);
	};

	const handleSharingUpdated = () => {
		refresh();
	};

	const handlePasswordUpdated = (protectedStatus: boolean) => {
		setPasswordProtected(protectedStatus);
		refresh();
	};

	/**
	 * Who can actually watch this, in words. "Shared" on its own told the owner
	 * nothing: not whether the link is public, not who it reaches. The label
	 * names the widest audience and the tooltip spells out what that means.
	 */
	const audience = describeShareAudience({
		isPublic: Boolean(data.public),
		allowedEmailDomain:
			allowLinkOverride && linkOpenToAnyone ? null : allowedEmailDomain,
		passwordProtected: effectivePasswordProtected,
		audienceNames: [
			...(sharedOrganizations ?? []).map((org) => org.name),
			...(effectiveSharedSpaces ?? [])
				.filter(
					(space) => !sharedOrganizations.some((org) => org.id === space.id),
				)
				.map((space) => space.name),
		],
		viewerCount,
	});

	const renderSharedStatus = () => {
		if (!isOwner) {
			return (
				<span className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-gray-4 px-3 text-xs font-medium text-gray-11">
					<Users className="size-3.5 text-gray-10" aria-hidden />
					Shared with you
				</span>
			);
		}

		const AudienceIcon =
			audience.kind === "public"
				? Globe2
				: audience.kind === "spaces" || audience.kind === "people"
					? Users
					: Lock;

		return (
			<Tooltip content={audience.tooltip} position="bottom">
				<Button
					className={clsx(ACTION_BAR_BUTTON_CLASS, "max-w-[48vw] shrink")}
					size="xs"
					variant="outline"
					aria-label={`Who can watch: ${audience.label}`}
					onClick={() => setIsSharingDialogOpen(true)}
				>
					<AudienceIcon className="size-3.5 shrink-0 text-gray-11" />
					<span className="truncate">{audience.label}</span>
					<FontAwesomeIcon
						className="size-2.5 shrink-0 text-gray-10"
						icon={faChevronDown}
					/>
				</Button>
			</Tooltip>
		);
	};

	/**
	 * Distribution, next to the audience pill that says who it can reach. The
	 * pill answers "who can see this"; this answers "get it in front of them".
	 * Signed-out viewers get it too on a public Cap — passing a link on is the
	 * one thing they can usefully do here.
	 */
	const renderShareButton = (className?: string) => (
		<Button
			className={clsx("gap-1.5 px-3", className)}
			size="xs"
			variant="blue"
			aria-label="Share this video"
			onClick={openShareLinkDialog}
			onPointerEnter={() => {
				void importShareLinkDialog();
			}}
			onFocus={() => {
				void importShareLinkDialog();
			}}
		>
			<FontAwesomeIcon className="size-3" icon={faShare} />
			Share
		</Button>
	);

	const analyticsHref = `/dashboard/analytics?capId=${data.id}`;
	const canSeeAnalytics =
		isOwner || data.organizationMembers?.some((id) => id === user?.id);
	const dateIsValid = !Number.isNaN(data.createdAt.getTime());
	const customThumbnail = getCustomThumbnailMetadata(data.metadata);
	const canPickThumbnailFrame =
		!data.hasActiveUpload &&
		(data.source.type === "desktopMP4" || data.source.type === "webMP4");
	return (
		<>
			{sharingDialogMounted && (
				<SharingDialog
					isOpen={isSharingDialogOpen}
					onClose={() => setIsSharingDialogOpen(false)}
					capId={data.id}
					capName={data.name}
					sharedSpaces={effectiveSharedSpaces || []}
					onSharingUpdated={handleSharingUpdated}
					isPublic={data.public}
					allowedEmailDomain={allowedEmailDomain}
					allowLinkOverride={allowLinkOverride}
					linkOpenToAnyone={linkOpenToAnyone}
					spacesData={spacesData}
					hasPassword={passwordProtected}
					inheritedPasswordSources={data.inheritedPasswordSources}
					onPasswordUpdated={handlePasswordUpdated}
					user={user}
					onUpgradeRequest={setUpgradeModalOpen}
					shareUrl={getVideoLink()}
				/>
			)}
			{shareLinkDialogMounted && (
				<ShareLinkDialog
					open={isShareLinkDialogOpen}
					onOpenChange={setIsShareLinkDialogOpen}
					videoId={data.id}
					videoTitle={displayTitle}
					shareUrl={getVideoLink()}
					isPublic={Boolean(data.public)}
					canManageAccess={Boolean(isOwner)}
					onManageAccess={() => {
						setIsShareLinkDialogOpen(false);
						setIsSharingDialogOpen(true);
					}}
					ownerIsPro={data.owner.isPro}
				/>
			)}
			{isOwner && (
				<>
					{moveDialogMounted && (
						<MoveItemsDialog
							open={moveDialogOpen}
							onOpenChange={setMoveDialogOpen}
							location={{ type: "personal" }}
							rootLabel="My videos"
							organizationId={data.orgId ?? undefined}
							item={{
								type: "videos",
								videoIds: [data.id],
								currentFolderId: data.folderId,
							}}
						/>
					)}
					{settingsDialogMounted && (
						<SettingsDialog
							isOpen={isSettingsDialogOpen}
							onClose={() => setIsSettingsDialogOpen(false)}
							capId={data.id}
							settingsData={data.videoSettings ?? undefined}
							inheritedSpaceSettings={data.inheritedSpaceSettings}
							user={user}
							organizationSettings={data.orgSettings}
							onSaved={refresh}
						/>
					)}
					{passwordDialogMounted && (
						<PasswordDialog
							isOpen={isPasswordDialogOpen}
							onClose={() => setIsPasswordDialogOpen(false)}
							videoId={data.id}
							hasPassword={passwordProtected}
							onPasswordUpdated={handlePasswordUpdated}
						/>
					)}
					{ctaDialogMounted && (
						<CallToActionDialog
							open={isCtaDialogOpen}
							onOpenChange={setIsCtaDialogOpen}
							target={{
								kind: "video",
								videoId: data.id,
								source: data.callToActionSource ?? null,
								workspaceCallToAction: data.workspaceCallToAction ?? null,
							}}
							callToAction={data.callToAction ?? null}
							onSaved={refresh}
							onUpgradeRequest={() => setUpgradeModalOpen(true)}
							brandColor={brandColor}
						/>
					)}
					{thumbnailDialogMounted && (
						<CustomThumbnailDialog
							open={isThumbnailDialogOpen}
							onOpenChange={setIsThumbnailDialogOpen}
							videoId={data.id}
							hasCustomThumbnail={customThumbnail !== null}
							canPickFrame={canPickThumbnailFrame}
							initialFrameTime={customThumbnail?.time ?? null}
						/>
					)}
					{deleteDialogMounted && (
						<DeleteCapDialog
							open={isDeleteDialogOpen}
							videoId={data.id}
							videoTitle={displayTitle}
							onClose={() => setIsDeleteDialogOpen(false)}
						/>
					)}
				</>
			)}
			<div className="min-w-0">
				{isOwner && (
					<nav
						aria-label="Video owner tools"
						className="absolute inset-x-4 top-3 flex min-h-9 items-center gap-1.5 sm:inset-x-6 sm:gap-2"
					>
						{dashboardDestination ? (
							<DashboardBackLink
								destination={dashboardDestination}
								label="My videos"
							/>
						) : (
							<Link
								href="/dashboard/caps"
								className="shrink-0 text-sm text-gray-11"
							>
								‹ My videos
							</Link>
						)}
						<div className="flex-1" />
						<span className="mr-1 hidden whitespace-nowrap text-xs text-[#9A9A9A] sm:inline">
							Only you see this row
						</span>
						{renderSharedStatus()}
						{canDownload &&
							(hasEdits ? (
								<VideoDownloadMenu
									videoId={data.id}
									hasEdits
									triggerLabel="Download"
									triggerClassName={clsx(
										ACTION_BAR_BUTTON_CLASS,
										"inline-flex items-center border border-gray-5 hover:bg-gray-3",
									)}
									trigger={
										<>
											<Download className="size-4" aria-hidden />{" "}
											<span className="hidden sm:inline">Download</span>
										</>
									}
								/>
							) : (
								<Button
									variant="outline"
									size="xs"
									className={ACTION_BAR_BUTTON_CLASS}
									aria-label="Download"
									disabled={isDownloading}
									onClick={() => download("current")}
								>
									<Download className="size-4" aria-hidden />{" "}
									<span className="hidden sm:inline">Download</span>
								</Button>
							))}
						<DropdownMenu modal={false}>
							<DropdownMenuTrigger asChild>
								<Button
									variant="outline"
									size="xs"
									aria-label="More for this video"
									className={clsx(ACTION_BAR_BUTTON_CLASS, "w-9 px-0 sm:px-0")}
								>
									<FontAwesomeIcon className="size-4" icon={faEllipsis} />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end" sideOffset={6} className="w-60">
								{!data.isScreenshot && (
									<DropdownMenuItem
										onSelect={() => setIsThumbnailDialogOpen(true)}
									>
										<ImageIcon className="mr-2 size-4" /> Change thumbnail
									</DropdownMenuItem>
								)}
								{canMoveToFolder && (
									<DropdownMenuItem
										onSelect={() => {
											setMoveDialogMounted(true);
											setMoveDialogOpen(true);
										}}
									>
										<FolderInput className="mr-2 size-4" /> Move to a space
									</DropdownMenuItem>
								)}
								<DropdownMenuItem
									onSelect={() =>
										user.isPro
											? setIsPasswordDialogOpen(true)
											: setUpgradeModalOpen(true)
									}
								>
									<FontAwesomeIcon className="mr-2 size-4" icon={faLock} />
									{passwordProtected ? "Change password" : "Add a password"}
								</DropdownMenuItem>
								<DropdownMenuSeparator />
								<DropdownMenuItem onSelect={() => push(analyticsHref)}>
									<FontAwesomeIcon
										className="mr-2 size-4"
										icon={faChartSimple}
									/>{" "}
									Views and reactions
									<Suspense fallback={null}>
										<span className="ml-auto pl-2 text-xs text-gray-10">
											<ViewCount views={views} />
										</span>
									</Suspense>
								</DropdownMenuItem>
								<DropdownMenuItem
									onSelect={() => setIsSettingsDialogOpen(true)}
								>
									<FontAwesomeIcon className="mr-2 size-4" icon={faGear} />{" "}
									Video settings
								</DropdownMenuItem>
								{data.owner.isPro && (
									<DropdownMenuItem onSelect={() => setIsCtaDialogOpen(true)}>
										<MousePointer2 className="mr-2 size-4" />
										{data.callToAction
											? "Edit call to action"
											: "Add call to action"}
									</DropdownMenuItem>
								)}
								<DropdownMenuSeparator />
								<DropdownMenuItem
									onSelect={() => setIsDeleteDialogOpen(true)}
									className="text-[var(--share-accent-text)] focus:text-[var(--share-accent-text)] hover:text-[var(--share-accent-text)]"
								>
									<FontAwesomeIcon className="mr-2 size-4" icon={faTrash} />{" "}
									Delete video
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</nav>
				)}
				{!isOwner && dashboardDestination && (
					<DashboardBackLink destination={dashboardDestination} />
				)}
				<div className={clsx("flex flex-col", isOwner ? "gap-2" : "gap-4")}>
					<div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
						{/* The title takes the row's slack rather than splitting it with
						    the link button: `justify-between` on two shrinkable items had
						    both of them truncating at once, so the title ran out of room
						    while there was still empty header to its right. */}
						<div className="flex min-w-0 items-center gap-3 lg:flex-1">
							<div className="flex min-w-0 flex-1 items-center gap-2">
								{/*
								 * Heading and rename field are the same box: same width, same
								 * type, same position, so opening the field changes nothing on
								 * screen but the caret.
								 *
								 * The box is as wide as the words and no wider, and it grows as
								 * you type until it runs out of header — `minmax(0, max-content)`
								 * is what caps it there, and the hidden sizer is what gives it
								 * its width. The field can't size itself: an input is 20
								 * characters wide whatever it holds, which is what collapsed the
								 * title into a stub the moment you clicked it.
								 *
								 * The negative margins let the surface behind the text breathe
								 * without moving the text off the header's alignment.
								 */}
								<div
									className={clsx(
										"relative -ml-2 -my-1 inline-grid min-w-0 max-w-full grid-cols-[minmax(0,max-content)] items-center rounded-lg px-2 py-1 align-middle ring-1 ring-transparent transition duration-150",
										isEditing
											? "bg-gray-1 ring-blue-500/50"
											: isOwner &&
													"cursor-text hover:bg-gray-3 has-[:focus-visible]:bg-gray-3 has-[:focus-visible]:ring-blue-500/50",
									)}
								>
									<span
										aria-hidden
										className={clsx(
											TITLE_TEXT_CLASS,
											"invisible col-start-1 row-start-1 overflow-hidden whitespace-pre",
										)}
									>
										{(isEditing ? editValue : displayTitle) ||
											TITLE_PLACEHOLDER}
									</span>
									{isEditing ? (
										<input
											ref={titleInputRef}
											value={editValue}
											// Sized by the grid track, not by this — but the browser's
											// 20-character default would otherwise be the track's floor
											// and short titles would get a box far wider than the word.
											size={1}
											maxLength={255}
											spellCheck={false}
											autoComplete="off"
											aria-label="video title"
											placeholder={TITLE_PLACEHOLDER}
											onChange={(e) => setEditValue(e.target.value)}
											onBlur={handleTitleBlur}
											onKeyDown={handleTitleKeyDown}
											className={clsx(
												TITLE_TEXT_CLASS,
												"col-start-1 row-start-1 w-full min-w-0 border-0 bg-transparent p-0 outline-none placeholder:text-gray-9",
											)}
										/>
									) : (
										<h1
											className={clsx(
												TITLE_TEXT_CLASS,
												"col-start-1 row-start-1 min-w-0 break-words",
											)}
										>
											{isOwner ? (
												<button
													ref={titleButtonRef}
													type="button"
													// `leading-[inherit]`: the base layer gives every bare
													// button a 1.5rem line height, which would leave the
													// heading stubbier than the field and bump the text
													// every time you clicked it.
													className="block w-full cursor-text break-words text-left leading-[inherit] outline-none"
													onClick={startEditing}
												>
													{displayTitle}
												</button>
											) : (
												displayTitle
											)}
										</h1>
									)}
									{isTitleRevealing && (
										<span aria-hidden className="ai-title-skeleton" />
									)}
								</div>
								{isOwner && !isEditing && (
									<button
										type="button"
										aria-label="Rename video"
										onClick={startEditing}
										className="inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] text-[#9A9A9A] hover:bg-gray-3"
									>
										<Pencil className="size-4" aria-hidden />
									</button>
								)}
							</div>
						</div>
					</div>
					<div className="flex flex-col gap-3 lg:flex-row lg:items-center">
						<div className="flex min-w-0 items-center justify-between gap-3 lg:justify-start lg:gap-5">
							<div className="flex min-w-0 items-center gap-2">
								{data.name && (
									<SignedImageUrl
										name={data.owner.name ?? "Someone"}
										image={data.owner.image}
										className="size-6 shrink-0 rounded-full"
										letterClass="text-xs"
									/>
								)}
								<div className="flex min-w-0 flex-wrap items-center gap-x-2 text-left">
									<p className="truncate text-sm font-medium">
										{data.owner.name}
									</p>
									<p
										className={clsx(
											"truncate text-gray-10",
											canSeeAnalytics ? "text-sm" : "text-xs",
										)}
									>
										·{" "}
										{canSeeAnalytics && dateIsValid ? (
											<time dateTime={data.createdAt.toISOString()}>
												{OWNER_DATE.format(data.createdAt)}
											</time>
										) : (
											<RelativeTime date={data.createdAt} format={fromNow} />
										)}
										{canSeeAnalytics &&
											data.duration != null &&
											!data.isScreenshot && (
												<> · {formatClock(data.duration)}</>
											)}
									</p>
									{canSeeAnalytics && (
										<Suspense fallback={null}>
											<ViewCount views={views} href={analyticsHref} />
										</Suspense>
									)}
								</div>
							</div>
							{isOwner ? null : user !== null ? (
								<div className="flex min-w-0 max-w-[60%] justify-end lg:max-w-xs">
									{renderSharedStatus()}
								</div>
							) : canDownload ? (
								<div className="flex shrink-0 items-center gap-2">
									<Button
										variant="gray"
										size="xs"
										className="gap-1.5 px-3"
										disabled={isDownloading}
										onClick={() => download("current")}
									>
										<Download className="size-3.5 text-gray-12" />
										Download
									</Button>
									{data.public && renderShareButton()}
								</div>
							) : (
								data.public && renderShareButton("shrink-0")
							)}
						</div>
						{!isOwner && user !== null && (
							<div className="flex flex-wrap items-center gap-2">
								{renderShareButton()}
								{/* Space and org members can download someone else's
									    Cap, and they never see "Manage Cap", so the action
									    has to stand on its own for them. */}
								{!isOwner &&
									canDownload &&
									(hasEdits ? (
										<VideoDownloadMenu
											videoId={data.id}
											hasEdits
											triggerLabel="Download"
											triggerClassName={clsx(
												ACTION_BAR_BUTTON_CLASS,
												"flex items-center justify-center border border-gray-5 bg-gray-3 text-gray-12 transition hover:bg-gray-6",
											)}
											trigger={
												<>
													<Download className="size-3.5" aria-hidden />
													Download
												</>
											}
										/>
									) : (
										<Button
											variant="gray"
											size="xs"
											className={ACTION_BAR_BUTTON_CLASS}
											disabled={isDownloading}
											onClick={() => download("current")}
										>
											<Download className="size-3.5 text-gray-12" />
											Download
										</Button>
									))}
							</div>
						)}
					</div>
				</div>
			</div>
			{upgradeModalMounted && (
				<UpgradeModal
					open={upgradeModalOpen}
					onOpenChange={setUpgradeModalOpen}
				/>
			)}
		</>
	);
};

/**
 * Suspends on the count alone, inside the meta line, so the rest of the header
 * paints immediately. A failed lookup resolves to null and simply says nothing
 * rather than taking the header down with it.
 */
function ViewCount({
	views,
	href,
}: {
	views?: MaybePromise<number | null>;
	href?: string;
}) {
	const count = views instanceof Promise ? use(views) : views;
	if (count === null || count === undefined) return null;
	if (!href) return count;
	return (
		<span className="text-sm text-gray-10">
			·{" "}
			<Link className="text-[#4F75FE] hover:underline" href={href}>
				{count} {count === 1 ? "view" : "views"}
			</Link>
		</span>
	);
}
