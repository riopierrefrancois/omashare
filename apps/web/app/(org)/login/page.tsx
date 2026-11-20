import { getCurrentUser } from "@cap/database/auth/session";
import { serverEnv } from "@cap/env";
import { redirect } from "next/navigation";
import { SignInShell } from "../SignInShell";
import { getSafeNextPath } from "../safe-next";
import { LoginForm } from "./form";

export const metadata = { title: "Sign in" };

export const dynamic = "force-dynamic";

export default async function LoginPage(props: {
	searchParams: Promise<{
		next?: string | string[];
		organizationId?: string | string[];
		connection_id?: string | string[];
		mobileProvider?: string | string[];
		sso?: string | string[];
		error?: string | string[];
	}>;
}) {
	const [searchParams, session] = await Promise.all([
		props.searchParams,
		getCurrentUser(),
	]);
	const [organizationId, connectionId, mobileProvider, sso, error] = [
		searchParams.organizationId,
		searchParams.connection_id,
		searchParams.mobileProvider,
		searchParams.sso,
		searchParams.error,
	].map((value) => (Array.isArray(value) ? value[0] : value));
	const isSsoEntry = Boolean(
		organizationId ||
			connectionId ||
			mobileProvider === "workos" ||
			sso === "1" ||
			error === "SsoSessionExpired" ||
			error === "SsoSignInFailed" ||
			error === "SsoMissingProfileAttributes" ||
			error === "profile_not_allowed_outside_organization" ||
			error === "signin_consent_denied",
	);

	if (session && !isSsoEntry) {
		redirect(getSafeNextPath(searchParams.next, serverEnv().WEB_URL));
	}

	const allowedDomains =
		serverEnv()
			.CAP_ALLOWED_SIGNUP_DOMAINS?.split(",")
			.map((domain) => domain.trim().replace(/^@/, ""))
			.filter(Boolean) ?? [];
	return (
		<SignInShell>
			<LoginForm allowedDomains={allowedDomains} />
		</SignInShell>
	);
}
