// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { ShareHeader } from "@/app/s/[videoId]/_components/ShareHeader";
import type { VideoData } from "@/app/s/[videoId]/types";

const auth = vi.hoisted(() => ({
	user: null as { id: string; isPro: boolean } | null,
}));

vi.mock("next/navigation", () => ({
	useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/app/Layout/AuthContext", () => ({
	useCurrentUser: () => auth.user,
}));
vi.mock("@/app/(org)/dashboard/DashboardContext", () => ({
	useDashboardContext: () => null,
}));
vi.mock("@/app/(org)/dashboard/_components/Navbar/server", () => ({
	updateActiveOrganization: vi.fn(),
}));
vi.mock("@/actions/videos/edit-title", () => ({ editTitle: vi.fn() }));
vi.mock("@/components/SignedImageUrl", () => ({ SignedImageUrl: () => null }));
vi.mock("@/components/Tooltip", () => ({
	Tooltip: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@/utils/public-env", () => ({
	usePublicEnv: () => ({ webUrl: "https://example.org" }),
}));
vi.mock("@/app/s/[videoId]/_components/use-video-download", () => ({
	useVideoDownload: () => ({ download: vi.fn(), isDownloading: false }),
}));

it("shows owner tools and orders the management actions for the owner only", async () => {
	vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
	const client = new QueryClient();
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	const data = {
		id: "video",
		name: "Example",
		owner: { id: "owner", name: "Owner", isPro: true },
		source: { type: "webMP4" },
		createdAt: new Date("2026-11-20T10:00:00Z"),
		duration: 252,
		organizationMembers: ["member"],
		public: true,
	} as VideoData;
	const render = () =>
		createElement(
			QueryClientProvider,
			{ client },
			createElement(ShareHeader, {
				data,
				canMoveToFolder: true,
				canDownload: true,
				views: 12,
			}),
		);

	try {
		await act(async () => root.render(render()));
		expect(
			container.querySelector('[aria-label="Video owner tools"]'),
		).toBeNull();
		expect(container.textContent).not.toContain("12 views");

		auth.user = { id: "member", isPro: true };
		await act(async () => root.render(render()));
		expect(
			container.querySelector('[aria-label="Video owner tools"]'),
		).toBeNull();

		expect(container.textContent).toContain("Nov 20 · 4:12");
		expect(container.textContent).toContain("12 views");

		auth.user = { id: "owner", isPro: true };
		await act(async () => root.render(render()));
		expect(
			container.querySelector('[aria-label="Video owner tools"]'),
		).not.toBeNull();
		expect(
			container.querySelector('a[href="/dashboard/analytics?capId=video"]')
				?.textContent,
		).toBe("12 views");
		const menuTrigger = container.querySelector(
			'[aria-label="More for this video"]',
		);
		await act(async () => {
			menuTrigger?.dispatchEvent(
				new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
			);
		});
		expect(
			Array.from(document.querySelectorAll('[role="menuitem"]'), (item) =>
				item.textContent?.trim(),
			),
		).toEqual([
			"Change thumbnail",
			"Move to a space",
			"Add a password",
			"Views and reactions12",
			"Video settings",
			"Add call to action",
			"Delete video",
		]);
	} finally {
		await act(async () => root.unmount());
		client.clear();
		container.remove();
		auth.user = null;
		vi.unstubAllGlobals();
	}
});
