"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { OmaShareMark } from "@/components/OmaShareMark";

import NavItems from "./Items";
import { SidebarAccount } from "./SidebarAccount";

export const AdminMobileNav = () => {
	const [sidebarOpen, setSidebarOpen] = useState(false);

	return (
		<>
			<AnimatePresence>
				{sidebarOpen ? (
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0, display: "none" }}
						className="flex fixed inset-0 z-[60] lg:hidden bg-gray-1/50"
					>
						<button
							type="button"
							aria-label="Close navigation"
							onClick={() => setSidebarOpen(false)}
							className="absolute inset-0"
						/>
						<motion.div
							initial={{ x: "100%" }}
							animate={{
								x: 0,
								transition: { duration: 0.3, bounce: 0.2, type: "spring" },
							}}
							exit={{ x: "100%" }}
							className="relative flex-1 flex flex-col ml-auto max-w-xs w-[275px] border-l border-gray-3 pt-5 pb-4 px-4 bg-gray-2"
						>
							<div className="flex justify-between items-center mb-4 w-full">
								<Link href="/dashboard" onClick={() => setSidebarOpen(false)}>
									<OmaShareMark />
								</Link>
								<button
									type="button"
									aria-label="Close navigation menu"
									onClick={() => setSidebarOpen(false)}
									className="flex justify-center items-center rounded-full"
								>
									<X className="text-gray-12 size-7" aria-hidden="true" />
								</button>
							</div>
							<NavItems toggleMobileNav={() => setSidebarOpen(false)} />
							<SidebarAccount
								inDrawer
								onNavigate={() => setSidebarOpen(false)}
							/>
						</motion.div>
					</motion.div>
				) : null}
			</AnimatePresence>
			<button
				type="button"
				className="flex size-9 shrink-0 items-center justify-center rounded-lg text-gray-11 hover:bg-gray-3"
				aria-label="Open navigation menu"
				aria-expanded={sidebarOpen}
				onClick={() => setSidebarOpen(true)}
			>
				<Menu className="size-5" aria-hidden />
			</button>
		</>
	);
};

export default AdminMobileNav;
