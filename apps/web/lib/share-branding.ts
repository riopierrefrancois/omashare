import type { ImageUpload, Organisation } from "@cap/web-domain";
import { playerColorFromOrganizationMetadata } from "@/lib/player-brand";

const hexColor = (value: unknown) =>
	typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value)
		? value.toUpperCase()
		: undefined;

const fontChoice = (value: unknown): Organisation.ShareBrandSettings["font"] =>
	value === "roboto" || value === "geist" ? value : undefined;

const websiteLabel = (value: unknown) =>
	typeof value === "string" && value.trim().length <= 80
		? value.trim() || undefined
		: undefined;

const httpsUrl = (value: unknown) => {
	if (typeof value !== "string" || value.length > 2048) return;
	try {
		const url = new URL(value);
		if (url.protocol === "https:" && !url.username && !url.password)
			return url.href;
	} catch {}
};

export function parseShareBrand(
	value: unknown,
): Organisation.ShareBrandSettings {
	if (!value || typeof value !== "object" || Array.isArray(value))
		throw new Error("Invalid share page look");
	const fields = [
		["accent", hexColor],
		["ink", hexColor],
		["page", hexColor],
		["font", fontChoice],
		["websiteLabel", websiteLabel],
		["websiteUrl", httpsUrl],
	] as const;
	const record = value as Record<string, unknown>;
	const brand: Record<string, string> = {};
	for (const [key, parse] of fields) {
		const raw = record[key];
		if (raw === undefined || raw === "") continue;
		const parsed = parse(raw);
		if (!parsed)
			throw new Error(
				key === "websiteUrl"
					? "Enter an HTTPS website URL."
					: "Check the colors, font, and website label.",
			);
		brand[key] = parsed;
	}
	return brand;
}

const channels = (color: string) =>
	[1, 3, 5].map((index) => Number.parseInt(color.slice(index, index + 2), 16));
const hex = (parts: number[]) =>
	`#${parts
		.map((part) => Math.round(part).toString(16).padStart(2, "0"))
		.join("")
		.toUpperCase()}`;

const linear = (value: number) => {
	const channel = value / 255;
	return channel <= 0.04045
		? channel / 12.92
		: ((channel + 0.055) / 1.055) ** 2.4;
};

export function shareBrandColors(accent: string, page: string) {
	const rgb = channels(accent);
	const pageRgb = channels(page);
	let accentText = accent;
	for (let weight = 100; weight >= 0; weight--) {
		const candidate = rgb.map((part) => Math.round((part * weight) / 100));
		const luminance = candidate.reduce(
			(sum, part, index) =>
				sum + linear(part) * ([0.2126, 0.7152, 0.0722][index] ?? 0),
			0,
		);
		if (1.05 / (luminance + 0.05) >= 4.5) {
			accentText = hex(candidate);
			break;
		}
	}
	return {
		accentText,
		accentSoft: hex(
			rgb.map((part, index) => part * 0.12 + (pageRgb[index] ?? 255) * 0.88),
		),
	};
}

export function getShareBrand(
	settings?: Organisation.ShareBrandSettings | null,
	identity?: { name?: string | null; logo?: ImageUpload.ImageUrl | null },
	organizationMetadata?: unknown,
) {
	const accent =
		hexColor(settings?.accent) ??
		hexColor(playerColorFromOrganizationMetadata(organizationMetadata)) ??
		"#2959C4";
	const ink = hexColor(settings?.ink) ?? "#1F2335";
	const page = hexColor(settings?.page) ?? "#FFFFFF";
	const url = httpsUrl(settings?.websiteUrl);
	return {
		name: identity?.name || null,
		logo: identity?.logo ?? null,
		accent,
		ink,
		page,
		font: fontChoice(settings?.font) ?? "geist",
		websiteUrl: url ?? null,
		websiteLabel: url
			? (websiteLabel(settings?.websiteLabel) ?? new URL(url).hostname)
			: null,
		...shareBrandColors(accent, page),
	};
}

export type ShareBrand = ReturnType<typeof getShareBrand>;
