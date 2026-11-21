"use client";

import { buildEnv } from "@cap/env";
import {
	Command,
	CommandGroup,
	CommandItem,
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@cap/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useClickAway } from "@uidotdev/usehooks";
import clsx from "clsx";
import { AnimatePresence } from "framer-motion";
import { Bell, Ellipsis, Moon, Sun } from "lucide-react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import {
	cloneElement,
	forwardRef,
	type MutableRefObject,
	memo,
	type RefObject,
	useImperativeHandle,
	useMemo,
	useRef,
	useState,
} from "react";
import { markAsRead } from "@/actions/notifications/mark-as-read";
import Notifications from "@/app/(org)/dashboard/_components/Notifications";
import { resetUser } from "@/app/utils/analytics";
import { SignedImageUrl } from "@/components/SignedImageUrl";
import { useDashboardContext, useTheme } from "../../Contexts";
import {
	LogoutIcon,
	MessageCircleMoreIcon,
	ReferIcon,
	SettingsGearIcon,
} from "../AnimatedIcons";
import type { DownloadIconHandle } from "../AnimatedIcons/Download";

export function SidebarAccount({
	compact = false,
	inDrawer = false,
	onNavigate,
}: {
	compact?: boolean;
	inDrawer?: boolean;
	onNavigate?: () => void;
}) {
	const { user, anyNewNotifications } = useDashboardContext();
	const [toggleNotifications, setToggleNotifications] = useState(false);
	const bellRef = useRef<HTMLButtonElement>(null);
	const queryClient = useQueryClient();
	const notificationsRef: MutableRefObject<HTMLDivElement> = useClickAway(
		(e) => {
			if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
				setToggleNotifications(false);
			}
		},
	);

	const markAllAsread = useMutation({
		mutationFn: () => markAsRead(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["notifications"],
			});
		},
		onError: (error) => {
			console.error("Error marking notifications as read:", error);
		},
	});

	return (
		<div
			className={clsx(
				"relative flex shrink-0 items-center gap-1 border-t border-gray-5 p-2 pt-3",
				compact && "flex-col",
			)}
		>
			<SignedImageUrl
				image={user.imageUrl}
				name={user.name ?? "User"}
				letterClass="text-xs"
				className="size-8 shrink-0"
			/>
			{!compact && (
				<span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-12">
					{user.name ?? "User"}
				</span>
			)}
			<div className="flex shrink-0">
				<button
					type="button"
					data-state={toggleNotifications ? "open" : "closed"}
					ref={bellRef}
					onClick={() => {
						if (anyNewNotifications) {
							markAllAsread.mutate();
						}
						setToggleNotifications(!toggleNotifications);
					}}
					aria-label={`Notifications${
						anyNewNotifications ? " (new notifications available)" : ""
					}`}
					aria-expanded={toggleNotifications}
					className="relative flex size-8 items-center justify-center rounded-lg text-gray-11 hover:bg-gray-3 data-[state=open]:bg-gray-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-6"
				>
					{anyNewNotifications && (
						<span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-blue-9" />
					)}
					<Bell className="size-4" aria-hidden />
				</button>
				<AnimatePresence>
					{toggleNotifications && (
						<Notifications
							ref={notificationsRef}
							className={
								inDrawer
									? "right-0 origin-bottom-right"
									: "left-0 origin-bottom-left"
							}
							onClose={() => setToggleNotifications(false)}
						/>
					)}
				</AnimatePresence>
			</div>
			<User onNavigate={onNavigate} />
		</div>
	);
}

const User = ({ onNavigate }: { onNavigate?: () => void }) => {
	const [menuOpen, setMenuOpen] = useState(false);
	const { theme, setThemeHandler } = useTheme();
	const nextTheme = theme === "light" ? "dark" : "light";
	const themeLabel =
		theme === "light" ? "Toggle Dark Mode" : "Toggle Light Mode";

	const menuItems = useMemo(
		() => [
			{
				name: "Earn 40% Referral",
				icon: <ReferIcon />,
				href: "/dashboard/refer",
				onClick: () => {
					setMenuOpen(false);
					onNavigate?.();
				},
				iconClassName: "text-gray-11 group-hover:text-gray-12",
				showCondition: buildEnv.NEXT_PUBLIC_IS_CAP,
			},
			{
				name: "Chat Support",
				icon: <MessageCircleMoreIcon />,
				onClick: () => window.open("https://cap.link/discord", "_blank"),
				iconClassName: "text-gray-11 group-hover:text-gray-12",
				showCondition: true,
			},
			{
				name: themeLabel,
				icon: <ThemeMenuIcon />,
				onClick: () => {
					setMenuOpen(false);
					if (document.startViewTransition) {
						document.startViewTransition(() => {
							setThemeHandler(nextTheme);
						});
					} else {
						setThemeHandler(nextTheme);
					}
				},
				iconClassName: "text-gray-11 group-hover:text-gray-12",
				showCondition: true,
			},
			{
				name: "Settings",
				icon: <SettingsGearIcon />,
				href: "/dashboard/settings/account",
				onClick: () => {
					setMenuOpen(false);
					onNavigate?.();
				},
				iconClassName: "text-gray-11 group-hover:text-gray-12",
				showCondition: true,
			},
			{
				name: "Sign Out",
				icon: <LogoutIcon />,
				onClick: () => {
					setMenuOpen(false);
					resetUser();
					signOut();
				},
				iconClassName: "text-gray-11 group-hover:text-gray-12",
				showCondition: true,
			},
		],
		[nextTheme, onNavigate, setThemeHandler, themeLabel],
	);

	return (
		<Popover open={menuOpen} onOpenChange={setMenuOpen}>
			<PopoverTrigger asChild>
				<button
					type="button"
					aria-label="Account menu"
					className="flex size-8 shrink-0 items-center justify-center rounded-lg text-gray-11 hover:bg-gray-3 data-[state=open]:bg-gray-3"
				>
					<Ellipsis className="size-5" aria-hidden />
				</button>
			</PopoverTrigger>
			<PopoverContent side="top" align="end" className="p-1 w-52">
				<Command>
					<CommandGroup>
						{menuItems
							.filter((item) => item.showCondition)
							.map((item, index) => (
								<MenuItem
									key={index.toString()}
									icon={item.icon}
									name={item.name}
									href={"href" in item ? item.href : undefined}
									onClick={item.onClick}
									iconClassName={item.iconClassName}
								/>
							))}
					</CommandGroup>
				</Command>
			</PopoverContent>
		</Popover>
	);
};

interface Props {
	icon: React.ReactElement<{
		ref: RefObject<DownloadIconHandle | null>;
		className: string;
		size: number;
	}>;
	name: string;
	href?: string;
	onClick: () => void;
	iconClassName?: string;
}

const MenuItem = memo(({ icon, name, href, onClick, iconClassName }: Props) => {
	const iconRef = useRef<DownloadIconHandle>(null);
	const content = (
		<>
			<div className="flex flex-shrink-0 justify-center items-center w-3.5 h-3.5">
				{cloneElement(icon, {
					ref: iconRef,
					className: iconClassName,
					size: 14,
				})}
			</div>
			<p className={clsx("text-sm text-gray-12")}>{name}</p>
		</>
	);

	return (
		<CommandItem
			key={name}
			className="px-2 py-1.5 rounded-lg transition-colors duration-150 cursor-pointer hover:bg-gray-3 aria-selected:bg-gray-3 group"
			onSelect={onClick}
			onMouseEnter={() => {
				iconRef.current?.startAnimation();
			}}
			onMouseLeave={() => {
				iconRef.current?.stopAnimation();
			}}
		>
			{href ? (
				<Link
					className="flex gap-2 items-center w-full"
					href={href}
					prefetch={true}
					onClick={onClick}
				>
					{content}
				</Link>
			) : (
				<div className="flex gap-2 items-center w-full">{content}</div>
			)}
		</CommandItem>
	);
});

const ThemeMenuIcon = forwardRef<
	DownloadIconHandle,
	{ className?: string; size?: number }
>(({ className, size = 14 }, ref) => {
	const { theme } = useTheme();
	const Icon = theme === "light" ? Moon : Sun;

	useImperativeHandle(ref, () => ({
		startAnimation: () => undefined,
		stopAnimation: () => undefined,
	}));

	return <Icon className={className} size={size} />;
});

ThemeMenuIcon.displayName = "ThemeMenuIcon";
