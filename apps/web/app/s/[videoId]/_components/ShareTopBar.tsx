import Image from "next/image";
import type { ShareBrand } from "@/lib/share-branding";

export function ShareTopBar({ brand }: { brand: ShareBrand }) {
	return (
		<header className="shrink-0 border-b border-gray-5 bg-white">
			<div className="mx-auto flex h-[52px] max-w-[1240px] items-center gap-2 px-3.5 sm:h-[60px] sm:gap-2.5 sm:px-6">
				<div className="flex min-w-0 flex-1 items-center gap-2 text-[17px] font-bold sm:text-lg">
					{brand.logo && (
						<Image
							src={brand.logo}
							alt=""
							width={28}
							height={28}
							unoptimized
							className="size-[26px] shrink-0 object-contain sm:size-7"
						/>
					)}
					{brand.name && <span className="truncate">{brand.name}</span>}
				</div>
				{brand.websiteUrl && (
					<a
						href={brand.websiteUrl}
						className="flex h-10 min-w-0 shrink-0 items-center rounded-[10px] bg-[var(--share-accent)] px-4 text-sm font-semibold !text-white"
					>
						<span className="truncate">Visit {brand.websiteLabel}</span>
					</a>
				)}
			</div>
		</header>
	);
}
