"use client";
import { Button } from "@cap/ui";
import clsx from "clsx";
import { motion } from "framer-motion";
import { useDetectPlatform } from "hooks/useDetectPlatform";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { OmaShareMark } from "@/components/OmaShareMark";
import { Tooltip } from "@/components/Tooltip";
import { useDashboardContext } from "../../Contexts";
import AdminNavItems from "./Items";
import { SidebarAccount } from "./SidebarAccount";

export const DesktopNav = () => {
	const { toggleSidebarCollapsed, sidebarCollapsed } = useDashboardContext();
	const { platform } = useDetectPlatform();
	const cmdSymbol = platform === "macos" ? "⌘" : "Ctrl";

	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (
				event.key === "s" &&
				(event.metaKey || event.ctrlKey) &&
				event.shiftKey
			) {
				event.preventDefault();
				toggleSidebarCollapsed();
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [toggleSidebarCollapsed]);

	return (
		<motion.aside
			initial={false}
			animate={{
				width: sidebarCollapsed ? 64 : 232,
				transition: {
					duration: 0.6,
					type: "spring",
					bounce: 0.25,
				},
			}}
			className={clsx(
				"hidden relative z-50 flex-1 h-full min-h-0 border-r border-gray-5 col-start-1 row-start-1 will-change-[width] lg:flex group",
			)}
		>
			<div className="flex flex-col mx-auto w-full h-full">
				<div className="flex justify-between items-center px-4 pt-4 mb-3 w-full truncate shrink-0 min-h-8">
					<Link href="/dashboard">
						<OmaShareMark compact={sidebarCollapsed} />
					</Link>
					<Tooltip
						kbd={[cmdSymbol, "Shift", "S"]}
						position="right"
						content="Toggle collapse"
					>
						<Button
							variant="white"
							onClick={toggleSidebarCollapsed}
							className={clsx(
								"p-0 min-w-[unset] rounded-lg transition-all z-10 opacity-0 group-hover:opacity-100 bg-transparent border-transparent hover:bg-gray-3 hover:border-transparent",
								sidebarCollapsed
									? "size-5 absolute right-0.5 top-6 rounded-full bg-gray-1 border-gray-4"
									: "size-7",
							)}
						>
							<ChevronRight
								size={sidebarCollapsed ? 12 : 14}
								className={clsx(
									"transition-transform duration-200 text-gray-10",
									!sidebarCollapsed ? "rotate-180" : "",
								)}
							/>
						</Button>
					</Tooltip>
				</div>
				<div className="flex flex-col flex-grow min-h-0">
					<div className="flex flex-col px-3 pb-4 h-full min-h-0">
						<AdminNavItems />
						<SidebarAccount compact={sidebarCollapsed} />
					</div>
				</div>
			</div>
		</motion.aside>
	);
};

export default DesktopNav;
