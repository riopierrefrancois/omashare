import "@/app/globals.css";
import "@/app/omashare.css";
import { buildEnv } from "@cap/env";
import { OpenPanelComponent } from "@openpanel/nextjs";
import type { Metadata } from "next";
import { Geist, Geist_Mono, Roboto } from "next/font/google";
import Script from "next/script";
import type { PropsWithChildren } from "react";

const geist = Geist({ subsets: ["latin"], variable: "--omashare-geist" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--omashare-mono" });
const roboto = Roboto({
	subsets: ["latin"],
	variable: "--omashare-roboto",
	preload: false,
});

export const metadata: Metadata = {
	metadataBase: new URL(buildEnv.NEXT_PUBLIC_WEB_URL),
	title: { default: "omashare", template: "%s · omashare" },
	description: "Share videos and get feedback.",
	icons: { icon: "/icon.svg", apple: "/apple-touch-icon.png" },
	manifest: "/site.webmanifest",
};

export default function RootLayout({ children }: PropsWithChildren) {
	return (
		// suppressHydrationWarning: the Cap Chrome extension stamps
		// data-cap-chrome-extension-installed on <html> at document_idle,
		// which can land before hydration finishes.
		<html
			className={`${geist.variable} ${mono.variable} ${roboto.variable}`}
			lang="en"
			suppressHydrationWarning
		>
			<body suppressHydrationWarning>
				<Script src="/theme-script.js" strategy="beforeInteractive" />
				{buildEnv.NEXT_PUBLIC_OPENPANEL_CLIENT_ID ? (
					<OpenPanelComponent
						apiUrl="/api/op"
						clientId={buildEnv.NEXT_PUBLIC_OPENPANEL_CLIENT_ID}
						scriptUrl="/api/op/op1.js"
						trackOutgoingLinks
						trackScreenViews
					/>
				) : null}
				<main className="w-full">{children}</main>
			</body>
		</html>
	);
}
