"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignedImageUrl } from "@/components/SignedImageUrl";
import { useDashboardContext } from "../../Contexts";
import { dashboardTitle } from "../dashboard-titles";
import { TOP_BAR_TITLE_SLOT_ID, TopBarCrumbSeparator } from "../TopBarTitle";

export default function DashboardPageTitle() {
	const pathname = usePathname();
	const { activeSpace } = useDashboardContext();
	const crumbs = dashboardTitle(pathname);

	if (pathname === "/dashboard/caps") return null;
	if (!activeSpace && !crumbs.length) return null;
	return (
		<div className="flex items-center w-full min-w-0 text-lg font-medium tracking-tight leading-6">
			<div
				id={TOP_BAR_TITLE_SLOT_ID}
				className="flex flex-1 items-center min-w-0 peer empty:hidden"
			/>
			<h1 className="flex items-center min-w-0 text-lg font-medium tracking-tight leading-6 peer-[:not(:empty)]:hidden">
				{activeSpace ? (
					<>
						<Link
							href="/dashboard/spaces/browse"
							className="shrink-0 text-gray-10 transition-colors hover:text-gray-12"
						>
							Spaces
						</Link>
						<TopBarCrumbSeparator />
						<SignedImageUrl
							image={activeSpace.iconUrl}
							name={activeSpace.name}
							letterClass="text-xs"
							className="relative flex-shrink-0 self-start mt-0.5 mr-2 size-5 lg:self-auto lg:mt-0"
						/>
						<span className="min-w-0 text-gray-12 [overflow-wrap:anywhere] lg:truncate">
							{activeSpace.name}
						</span>
					</>
				) : (
					crumbs.map((crumb, index) => {
						const isLast = index === crumbs.length - 1;
						return (
							<span
								key={crumb.label}
								className={clsx(
									"flex items-center",
									isLast ? "min-w-0" : "shrink-0",
								)}
							>
								{index > 0 && <TopBarCrumbSeparator />}
								{isLast || !crumb.href ? (
									<span
										className={clsx(
											"[overflow-wrap:anywhere] lg:truncate",
											isLast ? "text-gray-12" : "text-gray-10",
										)}
									>
										{crumb.label}
									</span>
								) : (
									<Link
										href={crumb.href}
										className="transition-colors text-gray-10 hover:text-gray-12"
									>
										{crumb.label}
									</Link>
								)}
							</span>
						);
					})
				)}
			</h1>
		</div>
	);
}
