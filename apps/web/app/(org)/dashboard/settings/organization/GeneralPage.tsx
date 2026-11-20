"use client";

import { SettingsCard, SettingsSection } from "./_components/settings-ui";
import DeleteOrg from "./components/DeleteOrg";
import { OrganizationDetailsCard } from "./components/OrganizationDetailsCard";

import { SharePageLook } from "./components/SharePageLook";

export function GeneralPage() {
	return (
		<div className="flex flex-col gap-10">
			<OrganizationDetailsCard />
			<SharePageLook />
			<SettingsSection title="Danger zone">
				<SettingsCard>
					<DeleteOrg />
				</SettingsCard>
			</SettingsSection>
		</div>
	);
}
