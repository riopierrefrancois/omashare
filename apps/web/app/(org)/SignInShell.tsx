import type { ReactNode } from "react";
import { SourceCredit } from "@/components/SourceCredit";

export function SignInShell({ children }: { children: ReactNode }) {
	return (
		<div className="flex min-h-dvh flex-col bg-white text-[#1F2335]">
			<div className="flex flex-1 items-center justify-center px-6 py-12">
				{children}
			</div>
			<SourceCredit workspace />
		</div>
	);
}
