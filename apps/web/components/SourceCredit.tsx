export function SourceCredit({
	workspace = false,
	website,
}: {
	workspace?: boolean;
	website?: { label: string; url: string };
}) {
	return (
		<footer className="flex flex-wrap justify-center gap-x-2 gap-y-1 border-t border-gray-5 px-4 py-4 text-center font-mono text-xs text-gray-10">
			{workspace && <span>omashare ·</span>}
			{website && (
				<span>
					<a href={website.url} className="hover:underline">
						{website.label}
					</a>{" "}
					·
				</span>
			)}
			<span>
				Built on{" "}
				<a
					className="underline-offset-2 hover:underline"
					href="https://github.com/CapSoftware/Cap"
				>
					Cap
				</a>{" "}
				(AGPL) ·
			</span>
			<a
				className="underline-offset-2 hover:underline"
				href="https://github.com/riopierrefrancois/omashare"
			>
				Source code
			</a>
		</footer>
	);
}
