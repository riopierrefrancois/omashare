import { describe, expect, it } from "vitest";
import { productRedirect } from "@/lib/product-routes";

describe("product route redirects", () => {
	it.each([
		"/s/example",
		"/embed/example",
		"/dashboard/settings",
		"/login",
		"/api/video",
		"/.well-known/mcp",
		"/privacy",
		"/robots.txt",
	])("keeps %s", (path) => {
		expect(productRedirect(path, false)).toBeNull();
	});

	it.each([
		"/",
		"/blog/article",
		"/features",
		"/pricing",
		"/docs/api.md",
		"/dashboarding",
	])("redirects %s according to session state", (path) => {
		expect(productRedirect(path, true)).toBe("/dashboard");
		expect(productRedirect(path, false)).toBe("/login");
	});
});
