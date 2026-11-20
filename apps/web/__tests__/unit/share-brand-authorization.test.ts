import { Organisation } from "@cap/web-domain";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ query: vi.fn() }));

vi.mock("@cap/database", async () => {
	const { drizzle } = await import("drizzle-orm/mysql-proxy");
	const database = drizzle(mocks.query);
	return { db: () => database };
});
vi.mock("@cap/database/auth/session", () => ({
	getCurrentUser: async () => ({ id: "viewer" }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { updateOrganizationSettings } from "@/actions/organization/settings";

const orgId = Organisation.OrganisationId.make("org");

describe("saving the share brand", () => {
	beforeEach(() => {
		mocks.query.mockReset().mockImplementation(async (query: string) => ({
			rows: query.startsWith("update") ? [{ affectedRows: 1 }] : [["org"]],
		}));
	});

	it.each([
		["admin", ["org", "other-user", "membership", "admin"]],
		["owner", ["org", "viewer", null, null]],
	] as const)("allows the %s to save only the brand", async (_, row) => {
		mocks.query
			.mockResolvedValueOnce({ rows: [["org"]] })
			.mockResolvedValueOnce({ rows: [row] });
		await expect(
			updateOrganizationSettings({ brand: { accent: "#ff0000" } }, orgId),
		).resolves.toEqual({ success: true });
		expect(mocks.query).toHaveBeenCalledWith(
			expect.stringContaining("JSON_SET(COALESCE"),
			['{"accent":"#FF0000"}', orgId],
			"execute",
		);
	});

	it("refuses a member before any settings write", async () => {
		mocks.query
			.mockResolvedValueOnce({ rows: [["org"]] })
			.mockResolvedValueOnce({
				rows: [["org", "other-user", "membership", "member"]],
			});
		await expect(
			updateOrganizationSettings({ brand: { accent: "#FF0000" } }, orgId),
		).rejects.toThrow("only available to admins and owners");
		expect(mocks.query).toHaveBeenCalledTimes(2);
	});
});
