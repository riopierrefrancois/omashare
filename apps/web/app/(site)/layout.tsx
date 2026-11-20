import "./tailwind-base.css";
import Link from "next/link";
import type { PropsWithChildren } from "react";
import { OmaShareMark } from "@/components/OmaShareMark";
import { SourceCredit } from "@/components/SourceCredit";

export default function Layout({ children }: PropsWithChildren) {
	return (
		<div className="flex min-h-dvh flex-col">
			<header className="border-b border-gray-5 px-6 py-4">
				<Link href="/dashboard">
					<OmaShareMark />
				</Link>
			</header>
			<div className="flex-1">{children}</div>
			<SourceCredit workspace />
		</div>
	);
}
