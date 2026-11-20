import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ShareTopBar } from "@/app/s/[videoId]/_components/ShareTopBar";
import { getShareBrand, shareBrandStyle } from "@/lib/share-branding";

vi.mock("@/utils/public-env", () => ({
	usePublicEnv: () => ({ webUrl: "https://example.org" }),
}));

function renderHeader(brand: ReturnType<typeof getShareBrand>) {
	return renderToStaticMarkup(
		createElement(ShareTopBar, {
			brand,
			title: "Example video",
			videoId: "example-video",
			customDomain: null,
			domainVerified: false,
		}),
	);
}

describe("share page chrome", () => {
	it("applies the default brand and hides the website link", () => {
		const brand = getShareBrand();
		expect(shareBrandStyle(brand)).toMatchObject({
			"--share-page": "#FFFFFF",
			"--share-ink": "#1F2335",
			"--share-accent": "#2959C4",
		});
		expect(renderHeader(brand)).toContain("Copy link");
		expect(renderHeader(brand)).not.toContain("href=");
	});

	it("uses the organization colors and shows its configured website", () => {
		const brand = getShareBrand(
			{
				accent: "#AB2345",
				ink: "#345678",
				page: "#F0E0D0",
				websiteUrl: "https://example.org",
				websiteLabel: "Example",
			},
			{ name: "Example organization" },
		);
		expect(shareBrandStyle(brand)).toMatchObject({
			"--share-page": "#F0E0D0",
			"--share-ink": "#345678",
			"--share-accent": "#AB2345",
		});
		const html = renderHeader(brand);
		expect(html).toContain("Example organization");
		expect(html).toContain('href="https://example.org/"');
		expect(html).toContain("Visit Example");
	});

	it("uses the former player color only when the accent is unset", () => {
		const metadata = { branding: { playerColor: "#123456" } };
		expect(getShareBrand({}, undefined, metadata).accent).toBe("#123456");
		expect(
			getShareBrand({ accent: "#234567" }, undefined, metadata).accent,
		).toBe("#234567");
	});
});
