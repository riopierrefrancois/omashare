// @vitest-environment jsdom

import { act, createElement, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
	type ImageLoadingStatus,
	VideoThumbnail,
} from "@/components/VideoThumbnail";

const query = vi.hoisted(() => ({
	data: undefined as string | undefined,
	isPending: false,
	isFetching: false,
	isError: false,
}));

vi.mock("@/lib/EffectRuntime", () => ({
	useEffectQuery: () => query,
}));

function Thumbnail({ uploading }: { uploading?: boolean }) {
	const [imageStatus, setImageStatus] = useState<ImageLoadingStatus>("loading");
	return createElement(VideoThumbnail, {
		videoId: "recording" as Parameters<typeof VideoThumbnail>[0]["videoId"],
		alt: "Recording preview",
		imageStatus,
		setImageStatus,
		hasActiveUpload: uploading,
	});
}

let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
	vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
	Object.assign(query, {
		data: undefined,
		isPending: false,
		isFetching: false,
		isError: false,
	});
	container = document.createElement("div");
	document.body.append(container);
	root = createRoot(container);
});

afterEach(async () => {
	await act(async () => root.unmount());
	container.remove();
	vi.unstubAllGlobals();
});

const spinner = () =>
	container.querySelector('[aria-label="Loading thumbnail"]');
const fallback = () =>
	container.querySelector('[aria-label="Thumbnail unavailable"]');

it.each([false, true])(
	"shows a quiet tile after the request completes without a URL (error=%s)",
	async (isError) => {
		query.isPending = true;
		query.isFetching = true;
		await act(async () => root.render(createElement(Thumbnail)));
		expect(spinner()).not.toBeNull();
		expect(fallback()).toBeNull();

		Object.assign(query, { isPending: false, isFetching: false, isError });
		await act(async () => {
			root.render(createElement(Thumbnail, { uploading: false }));
		});
		expect(spinner()).toBeNull();
		expect(fallback()?.querySelector("svg")).not.toBeNull();
	},
);

it("shows a quiet tile after the image fails to load", async () => {
	query.data = "https://example.com/thumbnail.png";
	await act(async () => root.render(createElement(Thumbnail)));
	const image = container.querySelector("img");
	expect(spinner()).not.toBeNull();
	expect(image).not.toBeNull();

	await act(async () => image?.dispatchEvent(new Event("error")));
	expect(spinner()).toBeNull();
	expect(fallback()).not.toBeNull();
	expect(image?.getAttribute("aria-hidden")).toBe("true");
});
