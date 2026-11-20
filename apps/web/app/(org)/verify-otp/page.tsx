import { getCurrentUser } from "@cap/database/auth/session";
import { isEmailDeliveryConfigured } from "@cap/database/emails/config";
import { serverEnv } from "@cap/env";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { SignInShell } from "../SignInShell";
import { getSafeNextPath } from "../safe-next";
import { VerifyOTPForm } from "./form";

export const metadata = {
	title: "Verify code",
};

export default async function VerifyOTPPage(props: {
	searchParams: Promise<{ email?: string; next?: string; lastSent?: string }>;
}) {
	const searchParams = await props.searchParams;
	const user = await getCurrentUser();

	if (user) {
		redirect(getSafeNextPath(searchParams.next, serverEnv().WEB_URL));
	}

	if (!searchParams.email) {
		redirect("/login");
	}

	return (
		<SignInShell>
			<Suspense fallback={null}>
				<VerifyOTPForm
					email={searchParams.email?.toLowerCase() ?? ""}
					next={searchParams.next}
					lastSent={searchParams.lastSent}
					emailDeliveryConfigured={isEmailDeliveryConfigured()}
				/>
			</Suspense>
		</SignInShell>
	);
}
