import { db } from "@cap/database";
import { organizations } from "@cap/database/schema";
import type { Organisation } from "@cap/web-domain";
import { eq } from "drizzle-orm";

export async function getShareOrganizationName(
	id: Organisation.OrganisationId,
) {
	const [organization] = await db()
		.select({ name: organizations.name })
		.from(organizations)
		.where(eq(organizations.id, id))
		.limit(1);
	return organization?.name ?? null;
}
