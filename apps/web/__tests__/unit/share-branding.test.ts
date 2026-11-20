import { describe, expect, it } from "vitest";
import {
	getShareBrand,
	parseShareBrand,
	shareBrandColors,
} from "@/lib/share-branding";

describe("share page brand", () => {
	it("fills the neutral defaults", () => {
		expect(getShareBrand()).toEqual({
			name: null,
			logo: null,
			accent: "#2959C4",
			ink: "#1F2335",
			page: "#FFFFFF",
			font: "geist",
			websiteUrl: null,
			websiteLabel: null,
			accentText: "#2959C4",
			accentSoft: "#E5EBF8",
		});
	});

	it("mixes the chip tint with the page and darkens light accent text", () => {
		expect(shareBrandColors("#FFFFFF", "#000000")).toEqual({
			accentText: "#757575",
			accentSoft: "#1F1F1F",
		});
	});

	it("normalizes valid settings and uses the hostname when the label is absent", () => {
		const brand = parseShareBrand({
			accent: "#ff8844",
			font: "roboto",
			websiteUrl: "https://example.org",
			websiteLabel: "",
		});
		expect(getShareBrand(brand, { name: "Example" })).toMatchObject({
			name: "Example",
			accent: "#FF8844",
			font: "roboto",
			websiteUrl: "https://example.org/",
			websiteLabel: "example.org",
		});
	});

	it.each([
		{ accent: "red" },
		{ page: "#12345Z" },
		{ font: "custom" },
		{ websiteUrl: "http://example.org" },
		{ websiteUrl: "https://user@example.org" },
	])("rejects invalid settings %j", (settings) => {
		expect(() => parseShareBrand(settings)).toThrow();
	});
});
