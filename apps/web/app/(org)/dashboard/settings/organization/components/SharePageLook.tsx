"use client";

import { Button, Input } from "@cap/ui";
import type { Organisation } from "@cap/web-domain";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { updateOrganizationSettings } from "@/actions/organization/settings";
import { SignedImageUrl } from "@/components/SignedImageUrl";
import {
	canManageOrganizationSettings,
	getEffectiveOrganizationRole,
} from "@/lib/permissions/roles";
import { getShareBrand, parseShareBrand } from "@/lib/share-branding";
import { useDashboardContext } from "../../../Contexts";
import { SettingsCard, SettingsSection } from "../_components/settings-ui";

const colors = [
	["accent", "Accent color"],
	["ink", "Text color"],
	["page", "Page color"],
] as const;

export function SharePageLook() {
	const { activeOrganization, organizationSettings, user } =
		useDashboardContext();
	const organization = activeOrganization?.organization;
	const role = getEffectiveOrganizationRole({
		userId: user.id,
		ownerId: organization?.ownerId,
		memberRole: activeOrganization?.members.find(
			({ userId }) => userId === user.id,
		)?.role,
	});
	if (!organization || !canManageOrganizationSettings(role)) return null;
	return (
		<SharePageLookForm
			key={organization.id}
			organization={organization}
			settings={organizationSettings?.brand}
		/>
	);
}

function SharePageLookForm({
	organization,
	settings,
}: {
	organization: NonNullable<
		ReturnType<typeof useDashboardContext>["activeOrganization"]
	>["organization"];
	settings?: Organisation.ShareBrandSettings;
}) {
	const [draft, setDraft] = useState<Organisation.ShareBrandSettings>(
		settings ?? {},
	);
	const [saving, setSaving] = useState(false);
	const [message, setMessage] = useState("");
	const router = useRouter();
	const websiteLabelId = useId();
	const websiteUrlId = useId();
	const defaults = getShareBrand();
	const preview = getShareBrand(draft, {
		name: organization.name,
		logo: organization.iconUrl,
	});
	return (
		<SettingsSection title="Share page look">
			<SettingsCard>
				<form
					className="grid gap-5 p-4 md:grid-cols-2"
					onSubmit={async (event) => {
						event.preventDefault();
						if (saving) return;
						let brand: Organisation.ShareBrandSettings;
						try {
							brand = parseShareBrand(draft);
						} catch (error) {
							setMessage(
								error instanceof Error ? error.message : "Check the settings.",
							);
							return;
						}
						setSaving(true);
						setMessage("");
						try {
							await updateOrganizationSettings({ brand }, organization.id);
							setMessage("Saved.");
							router.refresh();
						} catch {
							setMessage("Couldn’t save the share page look. Try again.");
						} finally {
							setSaving(false);
						}
					}}
				>
					<div className="grid gap-3">
						<div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
							{colors.map(([key, label]) => (
								<label
									key={key}
									htmlFor={`share-brand-${key}`}
									className="grid gap-1 text-sm"
								>
									{label}
									<Input
										id={`share-brand-${key}`}
										value={draft[key] ?? ""}
										placeholder={defaults[key]}
										maxLength={7}
										onChange={(event) =>
											setDraft({ ...draft, [key]: event.target.value })
										}
									/>
								</label>
							))}
						</div>
						<label className="grid gap-1 text-sm">
							Font
							<select
								className="rounded-lg border border-gray-5 bg-white px-3 py-2"
								value={draft.font ?? "geist"}
								onChange={(event) =>
									setDraft({
										...draft,
										font: event.target.value === "roboto" ? "roboto" : "geist",
									})
								}
							>
								<option value="geist">Geist</option>
								<option value="roboto">Roboto</option>
							</select>
						</label>
						<label htmlFor={websiteLabelId} className="grid gap-1 text-sm">
							Website label
							<Input
								id={websiteLabelId}
								maxLength={80}
								value={draft.websiteLabel ?? ""}
								onChange={(event) =>
									setDraft({ ...draft, websiteLabel: event.target.value })
								}
							/>
						</label>
						<label htmlFor={websiteUrlId} className="grid gap-1 text-sm">
							Website URL
							<Input
								id={websiteUrlId}
								type="url"
								placeholder="https://example.org"
								value={draft.websiteUrl ?? ""}
								onChange={(event) =>
									setDraft({ ...draft, websiteUrl: event.target.value })
								}
							/>
						</label>
						<div className="flex items-center gap-3">
							<Button type="submit" variant="dark" disabled={saving}>
								{saving ? "Saving…" : "Save"}
							</Button>
							<output className="text-sm text-gray-10">{message}</output>
						</div>
					</div>
					<div
						className="self-start overflow-hidden rounded-xl border border-gray-5"
						style={{ backgroundColor: preview.page, color: preview.ink }}
						data-share-font={preview.font}
					>
						<div className="flex items-center gap-2 border-b border-gray-5 bg-white px-3 py-2">
							{preview.logo && (
								<SignedImageUrl
									image={preview.logo}
									name={organization.name}
									className="size-7 rounded-md"
								/>
							)}
							<strong className="flex-1">{preview.name}</strong>
							{preview.websiteLabel && (
								<span
									className="rounded-lg px-2 py-1 text-sm text-white"
									style={{ backgroundColor: preview.accentText }}
								>
									{preview.websiteLabel}
								</span>
							)}
						</div>
						<article className="m-3 rounded-2xl border border-gray-5 bg-white p-3">
							<div className="flex items-center gap-2 text-sm">
								<strong>Viewer</strong>
								<span
									className="rounded px-1.5 py-0.5 text-xs"
									style={{
										backgroundColor: preview.accentSoft,
										color: preview.accentText,
									}}
								>
									2:31
								</span>
							</div>
							<p className="mt-2 text-sm">Thanks for sharing this.</p>
						</article>
					</div>
				</form>
			</SettingsCard>
		</SettingsSection>
	);
}
