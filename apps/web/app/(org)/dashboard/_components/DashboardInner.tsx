"use client";
import { SourceCredit } from "@/components/SourceCredit";
import { LibraryDoodleFilters } from "./library-doodles";
import { DashboardSearch } from "./Navbar/DashboardSearch";
import DashboardPageTitle from "./Navbar/Top";
import { TopBarTitleProvider } from "./TopBarTitle";

export default function DashboardInner({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<TopBarTitleProvider>
			<div className="dashboard-sheet flex min-w-0 flex-1 flex-col overflow-hidden">
				<LibraryDoodleFilters />
				<DashboardSearch showTrigger={false} />
				<main className="flex relative flex-col flex-1 h-full min-h-0">
					<div className="flex overflow-y-auto overscroll-y-contain relative flex-col flex-1 p-5 h-full lg:px-10 lg:pt-9">
						<div className="flex flex-col flex-1 gap-4 min-h-fit">
							<DashboardPageTitle />
							{children}
						</div>
						<SourceCredit workspace />
					</div>
				</main>
			</div>
		</TopBarTitleProvider>
	);
}
