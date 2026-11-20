"use client";

import type { comments as commentsSchema } from "@cap/database/schema";
import type { ViewerSettingKey } from "@cap/web-backend";
import type { Comment, ImageUpload, Video } from "@cap/web-domain";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import {
	Suspense,
	startTransition,
	use,
	useCallback,
	useEffect,
	useMemo,
	useOptimistic,
	useRef,
	useState,
} from "react";
import type { OrganizationSettings } from "@/app/(org)/dashboard/dashboard-data";
import type { ShareDashboardDestination } from "@/lib/share-dashboard-destination";
import type { SpaceUpNext } from "@/lib/space-up-next";
import {
	VideoStatusNotFoundError,
	videoStatusQueryOptions,
} from "@/lib/video-status-query";
import { CaptionProvider } from "./_components/CaptionContext";
import { SHARE_COMMENT_FIELD_ID } from "./_components/comments/CommentComposer";
import { GuestCommentNameProvider } from "./_components/comments/GuestCommentName";
import { ReactionCounts } from "./_components/comments/ReactionCounts";
import { ShareComments } from "./_components/comments/ShareComments";
import { seekLength } from "./_components/early-length";
import { PlaybackProvider } from "./_components/playback/PlaybackContext";
import { ShareVideo } from "./_components/ShareVideo";
import { type ShareView, ShareViewToggle } from "./_components/ShareViewToggle";
import { Sidebar } from "./_components/Sidebar";
import { Toolbar } from "./_components/Toolbar";
import { TimelineSkeleton } from "./_components/timeline/TimelineSkeleton";
import type { FilmstripSource } from "./_components/timeline/useFilmstripFrames";
import type { VideoData } from "./types";

const importTimelineView = () => import("./_components/timeline/TimelineView");
const TimelineView = dynamic(importTimelineView, { ssr: false });

type CommentWithAuthor = typeof commentsSchema.$inferSelect & {
	authorName: string | null;
	authorImage: ImageUpload.ImageUrl | null;
};

export type CommentType = Omit<
	typeof commentsSchema.$inferSelect,
	keyof Comment.CommentAuthor
> &
	Comment.CommentAuthor & {
		authorName?: string | null;
		authorImage?: ImageUpload.ImageUrl | null;
		sending?: boolean;
		/**
		 * The optimistic entry's temp id, carried onto the saved comment so lists
		 * can key the pair identically — the settle then updates the mounted card
		 * in place instead of remounting it (which would restart media playback).
		 */
		clientKey?: string;
	};

const SESSION_STORAGE_KEY = "cap_tb_session_id";
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes

const ensureAnalyticsSessionId = () => {
	if (typeof window === "undefined") return "anonymous";
	try {
		const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
		const now = Date.now();
		if (raw) {
			const parsed = JSON.parse(raw) as { value: string; expiry: number };
			if (parsed?.value && parsed.expiry > now) return parsed.value;
		}
		const newId =
			typeof crypto !== "undefined" && "randomUUID" in crypto
				? crypto.randomUUID()
				: Math.random().toString(36).slice(2);
		window.localStorage.setItem(
			SESSION_STORAGE_KEY,
			JSON.stringify({ value: newId, expiry: now + SESSION_TTL_MS }),
		);
		return newId;
	} catch (error) {
		console.warn("Failed to persist analytics session id", error);
		return "anonymous";
	}
};

const trackVideoView = (payload: {
	videoId: string;
	orgId?: string | null;
	ownerId?: string | null;
}) => {
	if (typeof window === "undefined") return;
	const sessionId = ensureAnalyticsSessionId();
	const screen = window.screen;
	const body = {
		videoId: payload.videoId,
		orgId: payload.orgId,
		ownerId: payload.ownerId,
		sessionId,
		pathname: window.location.pathname,
		href: window.location.href,
		referrer: document.referrer,
		hostname: window.location.hostname,
		timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
		language: typeof navigator !== "undefined" ? navigator.language : undefined,
		locale:
			typeof navigator !== "undefined" && navigator.languages?.length
				? navigator.languages[0]
				: undefined,
		screen: screen
			? {
					width: screen.width,
					height: screen.height,
					colorDepth: screen.colorDepth,
				}
			: undefined,
		userAgent:
			typeof navigator !== "undefined" ? navigator.userAgent : undefined,
		occurredAt: new Date().toISOString(),
	};

	const serializedBody = JSON.stringify(body);

	if (
		typeof navigator !== "undefined" &&
		typeof navigator.sendBeacon === "function"
	) {
		try {
			const beaconPayload = new Blob([serializedBody], {
				type: "application/json",
			});
			const queued = navigator.sendBeacon(
				"/api/analytics/track",
				beaconPayload,
			);
			if (queued) {
				return;
			}
		} catch (error) {
			console.warn("Falling back to fetch for analytics tracking", error);
		}
	}

	void fetch("/api/analytics/track", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: serializedBody,
		keepalive: true,
	}).catch((error) => {
		if (error?.name !== "AbortError") {
			console.warn("Failed to track analytics event", error);
		}
	});
};

type AiGenerationStatus =
	| "QUEUED"
	| "PROCESSING"
	| "COMPLETE"
	| "ERROR"
	| "SKIPPED";

type TranscriptionStatus =
	| "PROCESSING"
	| "COMPLETE"
	| "ERROR"
	| "SKIPPED"
	| "NO_AUDIO";

interface ShareProps {
	data: VideoData;
	upNext?: Promise<SpaceUpNext | null> | null;
	initialPlaybackUrl?: Promise<string | null>;
	serverPlaybackUrl?: string | null;
	posterUrl?: string | null;
	comments: MaybePromise<CommentWithAuthor[]>;
	views: MaybePromise<number>;
	screenshotImageUrl?: string | null;
	customDomain: string | null;
	domainVerified: boolean;
	videoSettings?: OrganizationSettings | null;
	userOrganizations?: { id: string; name: string }[];
	viewerId?: string | null;
	isEditProcessing: boolean;
	recordingStopped?: boolean;
	earlySegmentPlayback?: boolean;
	defaultPlaybackSpeed?: number;
	initialAiData?: {
		title?: string | null;
		summary?: string | null;
		chapters?: { title: string; start: number }[] | null;
		aiGenerationStatus?: AiGenerationStatus | null;
	} | null;
	aiGenerationAvailable: boolean;
	transcriptionGenerationAvailable: boolean;
	/** Server-resolved `?view=` so the first paint already has the right layout. */
	initialView?: ShareView;
	/** Server-resolved `?captions=off` so the player never flashes captions on before hiding them. */
	captionsInitiallyOff?: boolean;
	canRecordMedia?: boolean;
	viewerSignedIn?: boolean;
	header?: React.ReactNode;
	topBar?: React.ReactNode;
	footer?: React.ReactNode;
	dashboardDestination?: ShareDashboardDestination | null;
}

const useVideoStatus = (
	videoId: Video.VideoId,
	availability: {
		aiGeneration: boolean;
		transcriptionGeneration: boolean;
	},
	initialData?: {
		transcriptionStatus?: string | null;
		name?: string | null;
		aiData?: {
			title?: string | null;
			summary?: string | null;
			chapters?: { title: string; start: number }[] | null;
			aiGenerationStatus?: AiGenerationStatus | null;
		} | null;
	},
	enabled: boolean = true,
) => {
	return useQuery({
		...videoStatusQueryOptions(videoId),
		initialData: initialData
			? {
					transcriptionStatus:
						initialData.transcriptionStatus as TranscriptionStatus | null,
					aiGenerationStatus:
						(initialData.aiData?.aiGenerationStatus as AiGenerationStatus) ||
						null,
					name: initialData.name ?? null,
					aiTitle: initialData.aiData?.title || null,
					summary: initialData.aiData?.summary || null,
					chapters: initialData.aiData?.chapters || null,
				}
			: undefined,
		enabled,
		refetchInterval: (query) => {
			if (query.state.error instanceof VideoStatusNotFoundError) return false;
			const data = query.state.data;
			if (!data) return 2000;

			const shouldContinuePolling = () => {
				if (!data.transcriptionStatus) {
					return availability.transcriptionGeneration;
				}

				if (data.transcriptionStatus === "PROCESSING") {
					return true;
				}

				if (
					data.transcriptionStatus === "ERROR" ||
					data.transcriptionStatus === "SKIPPED" ||
					data.transcriptionStatus === "NO_AUDIO"
				) {
					return false;
				}

				if (data.transcriptionStatus === "COMPLETE") {
					if (!availability.aiGeneration) {
						return false;
					}

					if (
						data.aiGenerationStatus === "SKIPPED" ||
						data.aiGenerationStatus === "ERROR" ||
						data.aiGenerationStatus === "COMPLETE"
					) {
						return false;
					}

					if (
						data.aiGenerationStatus === "QUEUED" ||
						data.aiGenerationStatus === "PROCESSING"
					) {
						return true;
					}

					if (
						!data.aiGenerationStatus &&
						!data.summary &&
						!data.chapters?.length
					) {
						return true;
					}

					return false;
				}

				return false;
			};

			return shouldContinuePolling() ? 2000 : false;
		},
		refetchIntervalInBackground: false,
		staleTime: 1000,
	});
};

export const Share = ({
	data,
	initialPlaybackUrl,
	serverPlaybackUrl = null,
	posterUrl = null,
	comments,
	views,
	screenshotImageUrl,
	initialAiData,
	videoSettings,
	viewerId,
	isEditProcessing,
	recordingStopped = false,
	earlySegmentPlayback = false,
	defaultPlaybackSpeed,
	aiGenerationAvailable,
	transcriptionGenerationAvailable,
	initialView = "classic",
	captionsInitiallyOff = false,
	canRecordMedia = false,
	viewerSignedIn = false,
	header,
	topBar,
	footer,
	upNext = null,
}: ShareProps) => {
	const isScreenshot = data.isScreenshot === true;
	// Memoized: a fresh Date each render would defeat the memoized `data`
	// objects below and re-render Sidebar's whole tree on every poll tick.
	const customCreatedAt = data.metadata?.customCreatedAt;
	const effectiveDate: Date = useMemo(
		() => (customCreatedAt ? new Date(customCreatedAt) : data.createdAt),
		[customCreatedAt, data.createdAt],
	);

	const playerRef = useRef<HTMLVideoElement | null>(null);
	const stageRef = useRef<HTMLDivElement | null>(null);
	const focusComment = useCallback(() => {
		(playerRef.current?.isConnected
			? playerRef.current
			: stageRef.current?.querySelector("video")
		)?.pause();
		document.getElementById(SHARE_COMMENT_FIELD_ID)?.focus();
	}, []);
	const initialComments: CommentType[] =
		comments instanceof Promise ? use(comments) : comments;
	const [commentsData, setCommentsData] =
		useState<CommentType[]>(initialComments);
	const [optimisticComments, setOptimisticComments] = useOptimistic(
		commentsData,
		(state, newComment: CommentType) => {
			return [...state, newComment];
		},
	);

	const { data: videoStatus, error: videoStatusError } = useVideoStatus(
		data.id,
		{
			aiGeneration: aiGenerationAvailable,
			transcriptionGeneration: transcriptionGenerationAvailable,
		},
		{
			transcriptionStatus: data.transcriptionStatus,
			name: data.name,
			aiData: initialAiData,
		},
		!isScreenshot,
	);
	const router = useRouter();
	const videoWasDeleted = videoStatusError instanceof VideoStatusNotFoundError;
	useEffect(() => {
		if (videoWasDeleted) router.refresh();
	}, [videoWasDeleted, router]);

	const transcriptionStatus =
		videoStatus?.transcriptionStatus || data.transcriptionStatus;

	const aiData = useMemo(
		() => ({
			title: videoStatus?.aiTitle || null,
			summary:
				(videoStatus ? videoStatus.summary : initialAiData?.summary) ?? null,
			chapters:
				(videoStatus ? videoStatus.chapters : initialAiData?.chapters) ?? null,
			aiGenerationStatus: videoStatus?.aiGenerationStatus || null,
		}),
		[videoStatus, initialAiData],
	);

	useEffect(() => {
		if (viewerId && viewerId === data.owner.id) {
			return;
		}

		trackVideoView({
			videoId: data.id,
			orgId: data.orgId,
			ownerId: data.owner.id,
		});
	}, [data.id, data.orgId, data.owner.id, viewerId]);

	const isDisabled = (setting: ViewerSettingKey) =>
		videoSettings?.[setting] ?? data.orgSettings?.[setting] ?? false;

	const areChaptersDisabled = isScreenshot || isDisabled("disableChapters");
	const isSummaryDisabled = isScreenshot || isDisabled("disableSummary");
	const areCaptionsDisabled = isScreenshot || isDisabled("disableCaptions");
	const areCommentStampsDisabled = isDisabled("disableComments");
	const areReactionStampsDisabled = isDisabled("disableReactions");
	const hasSummary =
		(!isSummaryDisabled && Boolean(aiData.summary)) ||
		(!areChaptersDisabled && Boolean(aiData.chapters?.length));
	const hasTranscript =
		!isScreenshot &&
		!isDisabled("disableTranscript") &&
		transcriptionStatus === "COMPLETE";

	const searchParams = useSearchParams();
	const initialSeekDone = useRef(false);

	useEffect(() => {
		if (data.source.type === "desktopSegments") return;
		if (!searchParams.has("recordingStopped")) return;

		const url = new URL(window.location.href);
		url.searchParams.delete("recordingStopped");
		window.history.replaceState(
			window.history.state,
			"",
			`${url.pathname}${url.search}${url.hash}`,
		);
	}, [data.source.type, searchParams]);

	const cancelPendingSeek = useRef<(() => void) | null>(null);

	const handleSeek = useCallback((time: number) => {
		cancelPendingSeek.current?.();
		const v =
			playerRef.current ??
			(document.querySelector("video") as HTMLVideoElement | null);
		if (!v) {
			console.warn("Video player not ready");
			return;
		}
		const seekOnce = (t: number) => {
			const length = seekLength(v, v.duration);
			const dur = Number.isFinite(length) && length > 0 ? length : null;
			const clamped = dur ? Math.max(0, Math.min(dur - 0.001, t)) : t;
			try {
				v.currentTime = clamped;
			} catch (e) {
				console.error("Failed to seek video:", e);
			}
		};
		if (v.readyState >= 1) {
			seekOnce(time);
			return;
		}
		// A timeline seek before metadata moves currentTime; don't undo it.
		const requestedFrom = v.currentTime;
		const cancel = () => {
			v.removeEventListener("canplay", handleReady);
			v.removeEventListener("loadedmetadata", handleReady);
			if (cancelPendingSeek.current === cancel)
				cancelPendingSeek.current = null;
		};
		const handleReady = () => {
			cancel();
			if (v.currentTime === requestedFrom) seekOnce(time);
		};
		v.addEventListener("canplay", handleReady, { once: true });
		v.addEventListener("loadedmetadata", handleReady, { once: true });
		cancelPendingSeek.current = cancel;
	}, []);

	useEffect(() => {
		if (initialSeekDone.current) return;
		const tParam = searchParams.get("t");
		if (isScreenshot) return;
		if (!tParam) return;
		const t = parseInt(tParam, 10);
		if (!Number.isFinite(t) || t < 0) return;

		const v =
			playerRef.current ??
			(document.querySelector("video") as HTMLVideoElement | null);
		if (v) {
			initialSeekDone.current = true;
			handleSeek(t);
			return;
		}

		const interval = setInterval(() => {
			const el =
				playerRef.current ??
				(document.querySelector("video") as HTMLVideoElement | null);
			if (el) {
				clearInterval(interval);
				initialSeekDone.current = true;
				handleSeek(t);
			}
		}, 200);

		const timeout = setTimeout(() => clearInterval(interval), 10000);

		return () => {
			clearInterval(interval);
			clearTimeout(timeout);
		};
	}, [searchParams, handleSeek, isScreenshot]);

	const handleOptimisticComment = useCallback(
		(comment: CommentType) => {
			startTransition(() => {
				setOptimisticComments(comment);
			});
		},
		[setOptimisticComments],
	);

	const handleCommentSuccess = useCallback((realComment: CommentType) => {
		startTransition(() => {
			setCommentsData((prev) => [...prev, realComment]);
		});
	}, []);

	// If the settle ever commits the saved comment while its optimistic twin is
	// still applied, both would render under the same clientKey; keep only the
	// settled one. Almost always a no-op passthrough.
	const visibleComments = useMemo(() => {
		const settledKeys = new Set<string>();
		for (const comment of optimisticComments)
			if (!comment.sending && comment.clientKey)
				settledKeys.add(comment.clientKey);
		if (settledKeys.size === 0) return optimisticComments;
		return optimisticComments.filter(
			(comment) => !(comment.sending && settledKeys.has(comment.id)),
		);
	}, [optimisticComments]);

	// Stable identities for the spreads handed to ShareVideo and Sidebar —
	// without these, every Share render (each 2s status poll while a video is
	// processing) re-rendered both subtrees with brand-new `data` objects.
	const shareVideoData = useMemo(
		() => ({ ...data, transcriptionStatus }),
		[data, transcriptionStatus],
	);
	const sidebarData = useMemo(
		() => ({ ...data, createdAt: effectiveDate, transcriptionStatus }),
		[data, effectiveDate, transcriptionStatus],
	);

	const reduceMotion = useReducedMotion() ?? false;
	const [selectedView, setSelectedView] = useState<ShareView>(initialView);
	// Screenshots have no timeline to show, and a comments-disabled video has
	// nothing to branch — both stay on the classic layout even if someone
	// hand-writes `?view=timeline`. Over-quota videos stay classic too: the
	// timeline deck's filmstrip would leak frames below the upgrade gate.
	const timelineAvailable =
		!isScreenshot &&
		!areCommentStampsDisabled &&
		data.ownerIsOverShareLimit !== true;

	// Where the timeline's filmstrip frames come from. Mirrors the source split
	// in `ShareVideo`: instant recordings have a result.mp4 a bare <video> can
	// seek; everything else is an HLS playlist. A still-uploading segments
	// source gets no strip — its playlist is in flux and not worth hammering.
	const filmstripSource = useMemo<FilmstripSource | null>(() => {
		if (isScreenshot) return null;
		const sourceType = data.source.type;
		if (sourceType === "desktopMP4" || sourceType === "webMP4") {
			return {
				src: `/api/playlist?userId=${data.owner.id}&videoId=${data.id}&videoType=mp4`,
				kind: "native",
			};
		}
		if (sourceType === "desktopSegments") {
			if (data.hasActiveUpload) return null;
			return {
				src: `/api/playlist?userId=${data.owner.id}&videoId=${data.id}&videoType=segments-master`,
				kind: "hls",
			};
		}
		return {
			src: `/api/playlist?userId=${data.owner.id}&videoId=${data.id}&videoType=video`,
			kind: "hls",
		};
	}, [
		isScreenshot,
		data.source.type,
		data.owner.id,
		data.id,
		data.hasActiveUpload,
	]);
	// The theater block hugs the video: width-driven height from the real
	// aspect ratio, capped so the deck below stays reachable without scrolling.
	const stageAspect =
		data.width && data.height && data.width > 0 && data.height > 0
			? data.width / data.height
			: 16 / 9;

	const view: ShareView = timelineAvailable ? selectedView : "classic";
	const [morphing, setMorphing] = useState(false);
	const [stageFullscreen, setStageFullscreen] = useState(false);
	const [timelineRecording, setTimelineRecording] = useState(false);
	// The deck row the player's control bar portals into while the timeline is
	// up. Null until the lazily-loaded deck mounts; the bar stays on the video
	// (and returns there for fullscreen, which hides the deck).
	const [controlsSlot, setControlsSlot] = useState<HTMLElement | null>(null);

	const setViewAndUrl = useCallback((next: ShareView) => {
		setSelectedView(next);
		if (typeof window === "undefined") return;
		const url = new URL(window.location.href);
		if (next === "timeline") url.searchParams.set("view", "timeline");
		else url.searchParams.delete("view");
		// replaceState, not router.replace: the view is a presentation detail and
		// a Next navigation here would re-render the tree and remount the player.
		window.history.replaceState(
			window.history.state,
			"",
			`${url.pathname}${url.search}${url.hash}`,
		);
	}, []);

	const prefetchTimeline = useCallback(() => {
		void importTimelineView();
	}, []);

	// A toggle mid-fullscreen would rip the video out of the fullscreen element,
	// so disable it for as long as the stage owns the screen.
	useEffect(() => {
		const syncFullscreen = () => {
			const active = document.fullscreenElement;
			// `contains` is inclusive, so this also covers the stage itself.
			setStageFullscreen(Boolean(active && stageRef.current?.contains(active)));
		};
		syncFullscreen();
		document.addEventListener("fullscreenchange", syncFullscreen);
		return () =>
			document.removeEventListener("fullscreenchange", syncFullscreen);
	}, []);

	// T flips Player/Timeline, under the same guards as the toggle itself.
	useEffect(() => {
		if (!timelineAvailable) return;

		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key !== "t" && event.key !== "T") return;
			if (event.metaKey || event.ctrlKey || event.altKey) return;
			const target = event.target as HTMLElement | null;
			if (
				target instanceof HTMLInputElement ||
				target instanceof HTMLTextAreaElement ||
				target?.isContentEditable
			) {
				return;
			}
			if (stageFullscreen || timelineRecording) return;
			event.preventDefault();
			setViewAndUrl(view === "timeline" ? "classic" : "timeline");
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [
		timelineAvailable,
		stageFullscreen,
		timelineRecording,
		view,
		setViewAndUrl,
	]);

	const showRail = view === "classic" && (hasSummary || hasTranscript);

	return (
		<ShareProviders videoId={data.id} transcriptionStatus={transcriptionStatus}>
			<PlaybackProvider
				videoRef={playerRef}
				stageRef={stageRef}
				fallbackDuration={data.duration}
			>
				{topBar}
				<main className="mx-auto flex w-full max-w-[1240px] flex-1 flex-col items-start gap-6 p-4 sm:p-6 lg:flex-row">
					<div
						className={clsx(
							"min-w-0 w-full flex-1",
							view === "classic" && "rounded-xl bg-white shadow-sm",
						)}
					>
						<div
							className={clsx(
								view === "classic"
									? "px-4 pt-5 sm:px-10 sm:pt-8"
									: "mx-auto w-full max-w-6xl rounded-t-xl border border-b-0 border-gray-5 bg-white px-5 pt-4",
							)}
						>
							{header}
						</div>
						{timelineAvailable && view === "timeline" && (
							// The top edge of the player card. It sits flush on the grid
							// below (which carries the bottom corners and the rest of the
							// border), so the two read as one contained, rounded unit,
							// centred at the same width. Classic view's toggle lives under
							// the player instead.
							<div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-end gap-3 border-x border-gray-5 bg-white px-5">
								<div className="flex shrink-0 items-center gap-2">
									<ShareViewToggle
										view={view}
										onChange={setViewAndUrl}
										// Fullscreen: a morph would rip the video out of the
										// fullscreen element. Recording: leaving the timeline
										// unmounts the recorder and silently discards the take.
										disabled={stageFullscreen || timelineRecording}
										prefetch={prefetchTimeline}
									/>
								</div>
							</div>
						)}

						{/*
						 * One grid, two arrangements. The stage below is a single JSX node
						 * at a single tree position in both views. Only its grid placement
						 * and its siblings change, because remounting it would tear down
						 * the media-chrome store inside the player and restart playback.
						 */}
						<div
							className={clsx(
								"grid relative",
								// In timeline view the grid is the body of the player card:
								// contained, centred, bottom corners rounded (the title row
								// above carries the top ones). Background clips to the radius
								// on its own, so no overflow-clip — the shelf's cards must
								// escape.
								view === "timeline"
									? "mx-auto w-full max-w-6xl gap-0 rounded-b-xl border border-t-0 border-gray-5 bg-white"
									: "gap-4 px-4 py-5 sm:px-10",
								"lg:grid-cols-1",
							)}
						>
							<motion.div
								ref={stageRef}
								layout
								data-morphing={morphing ? "" : undefined}
								onLayoutAnimationStart={() => setMorphing(true)}
								onLayoutAnimationComplete={() => setMorphing(false)}
								transition={
									reduceMotion
										? { duration: 0 }
										: {
												type: "spring",
												stiffness: 260,
												damping: 32,
												mass: 0.9,
											}
								}
								className={clsx(
									"min-w-0",
									// Contained card, not full-bleed: the unit keeps the page's
									// gutters and sits centred with everything else.
									view === "timeline"
										? "lg:col-span-full lg:row-start-1"
										: "lg:col-start-1 lg:row-start-1",
								)}
							>
								{/*
								 * Classic: a white page card holding the video. Timeline: the
								 * screen at the top of the card, edge to edge and squared off,
								 * with the light chrome (strip, comments, controls) below it.
								 */}
								<div
									className={clsx(
										"overflow-visible relative transition-[border-radius] duration-300",
										// Timeline: the screen, sized by the video's own aspect ratio
										// (style below), so a landscape recording meets the strip
										// with no bar of black under it. It stays dark — the screen
										// is the one part of the card that isn't chrome, same as the
										// black box classic view paints inside its white card. The
										// colour is the player's dark `--background` token spelled
										// out (a `dark` class here would restyle every overlay
										// inside the stage).
										// The 340px budget covers the card's own chrome (title row,
										// strip, shelf, bar) plus page margins, so the centred card
										// always fits the viewport — justify-center clips at the
										// top if its content overflows.
										// The 280px floor is desktop-only: on a phone it would beat
										// the aspect ratio and letterbox the video away from the
										// strip. The 65svh cap keeps a portrait video from pushing
										// the deck below the fold; the video pillarboxes inside.
										view === "timeline"
											? "rounded-none bg-[hsl(224,71.4%,4.1%)] w-full max-h-[65svh] lg:min-h-[280px] lg:max-h-[calc(100vh-340px)]"
											: "rounded-xl bg-white aspect-video",
									)}
									style={
										view === "timeline"
											? { aspectRatio: String(stageAspect) }
											: undefined
									}
								>
									<div
										className={
											isScreenshot
												? "absolute inset-3 w-[calc(100%-1.5rem)] h-[calc(100%-1.5rem)] overflow-visible rounded-xl"
												: view === "timeline"
													? "absolute inset-0 overflow-visible"
													: "absolute inset-x-3 top-1/2 aspect-video -translate-y-1/2 overflow-visible rounded-xl"
										}
									>
										{isScreenshot ? (
											<ScreenshotImage
												src={screenshotImageUrl}
												alt={data.name}
											/>
										) : (
											<ShareVideo
												initialPlaybackUrl={initialPlaybackUrl}
												serverPlaybackUrl={serverPlaybackUrl}
												posterUrl={posterUrl}
												data={shareVideoData}
												comments={comments}
												areChaptersDisabled={areChaptersDisabled}
												areCaptionsDisabled={areCaptionsDisabled}
												captionsInitiallyOff={captionsInitiallyOff}
												// The deck under the video owns seeking, the clock and
												// comments in timeline view; duplicating them inside the
												// video reads as two players. Fullscreen hides the deck,
												// so the in-video versions come back for its duration.
												externalTimeline={
													view === "timeline" && !stageFullscreen
												}
												controlsPortalEl={
													view === "timeline" && !stageFullscreen
														? controlsSlot
														: null
												}
												areCommentStampsDisabled={
													areCommentStampsDisabled ||
													(view === "timeline" && !stageFullscreen)
												}
												areReactionStampsDisabled={
													areReactionStampsDisabled ||
													(view === "timeline" && !stageFullscreen)
												}
												chapters={aiData?.chapters ?? undefined}
												aiGenerationStatus={aiData?.aiGenerationStatus}
												canRetryProcessing={viewerId === data.owner.id}
												canFinalizeDesktopSegments={viewerId === data.owner.id}
												showPlaybackStatusBadge={viewerId === data.owner.id}
												isEditProcessing={isEditProcessing}
												recordingStopped={recordingStopped}
												earlySegmentPlayback={earlySegmentPlayback}
												defaultPlaybackSpeed={defaultPlaybackSpeed}
												viewerIsOwner={viewerId === data.owner.id}
												callToAction={data.callToAction}
												upNext={upNext}
												ref={playerRef}
											/>
										)}
									</div>
								</div>
							</motion.div>

							<AnimatePresence mode="popLayout" initial={false}>
								{view === "classic" ? (
									<motion.div
										key="toolbar"
										className="lg:col-span-full lg:row-start-2"
										initial={{ opacity: 0 }}
										animate={{ opacity: 1 }}
										exit={{ opacity: 0 }}
										transition={{ duration: reduceMotion ? 0 : 0.14 }}
									>
										<div className="flex flex-wrap items-center gap-2">
											{timelineAvailable && (
												<div className="flex justify-start">
													<ShareViewToggle
														view={view}
														onChange={setViewAndUrl}
														disabled={stageFullscreen || timelineRecording}
														prefetch={prefetchTimeline}
													/>
												</div>
											)}
											<Toolbar
												onOptimisticComment={handleOptimisticComment}
												onCommentSuccess={handleCommentSuccess}
												disableComments={areCommentStampsDisabled}
												disableReactions={areReactionStampsDisabled}
												onWriteComment={focusComment}
												data={data}
											/>
										</div>
										{!areReactionStampsDisabled && (
											<div className="[&:empty]:hidden mt-2">
												<ReactionCounts comments={visibleComments} />
											</div>
										)}
									</motion.div>
								) : (
									// The band runs its own enter/exit; this wrapper only exists
									// to give popLayout a motion child to pop out of the grid.
									<motion.div
										key="timeline"
										className="lg:col-span-full lg:row-start-2"
									>
										<Suspense fallback={<TimelineSkeleton />}>
											<TimelineView
												comments={visibleComments}
												videoId={data.id}
												chapters={aiData?.chapters ?? undefined}
												transcriptionStatus={transcriptionStatus}
												filmstripSource={filmstripSource}
												onOptimisticComment={handleOptimisticComment}
												onCommentSuccess={handleCommentSuccess}
												canRecordMedia={canRecordMedia}
												viewerSignedIn={viewerSignedIn}
												disableReactions={areReactionStampsDisabled}
												onRecordingActiveChange={setTimelineRecording}
												onControlsSlotChange={setControlsSlot}
											/>
										</Suspense>
									</motion.div>
								)}
							</AnimatePresence>
						</div>
						<div
							className={clsx(
								"rounded-b-xl border-t-2 border-gray-5 bg-[color-mix(in_srgb,var(--share-page)_50%,white)] px-4 py-5 sm:px-10",
								view === "timeline" &&
									"mx-auto mt-4 w-full max-w-6xl rounded-xl",
							)}
						>
							<ShareComments
								videoId={data.id}
								commentsData={commentsData}
								optimisticComments={visibleComments}
								setComments={setCommentsData}
								setOptimisticComments={setOptimisticComments}
								handleCommentSuccess={handleCommentSuccess}
								onSeek={isScreenshot ? undefined : handleSeek}
								commentsDisabled={areCommentStampsDisabled}
								isVideoOwner={viewerId === data.owner.id}
								ownerOrMemberViews={
									viewerId &&
									(viewerId === data.owner.id ||
										data.organizationMembers?.some((id) => id === viewerId))
										? views
										: undefined
								}
								isScreenshot={isScreenshot}
								canRecordMedia={canRecordMedia && !isScreenshot}
							/>
						</div>
					</div>
					{showRail && (
						<aside
							aria-label="Summary and transcript"
							className="w-full shrink-0 lg:w-[min(32%,360px)]"
						>
							<Sidebar
								data={sidebarData}
								hasSummary={hasSummary}
								hasTranscript={hasTranscript}
								isSummaryDisabled={isSummaryDisabled}
								areChaptersDisabled={areChaptersDisabled}
								onSeek={handleSeek}
								aiData={aiData}
								aiGenerationEnabled={aiGenerationAvailable}
							/>
						</aside>
					)}
				</main>
				{footer}
			</PlaybackProvider>
		</ShareProviders>
	);
};

function ScreenshotImage({ src, alt }: { src?: string | null; alt: string }) {
	if (!src) {
		return (
			<div className="flex size-full items-center justify-center rounded-xl bg-gray-2 text-sm text-gray-10">
				Screenshot unavailable
			</div>
		);
	}

	return (
		<div className="relative size-full rounded-xl">
			<Image
				src={src}
				alt={alt}
				fill
				priority
				unoptimized
				sizes="100vw"
				className="rounded-xl object-contain"
			/>
		</div>
	);
}

function ShareProviders({
	children,
	...caption
}: React.ComponentProps<typeof CaptionProvider>) {
	return (
		<GuestCommentNameProvider>
			<CaptionProvider {...caption}>{children}</CaptionProvider>
		</GuestCommentNameProvider>
	);
}
