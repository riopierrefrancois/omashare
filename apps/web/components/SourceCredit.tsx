export function SourceCredit({
	workspace = false,
	website,
	shareFont,
}: {
	workspace?: boolean;
	shareFont?: "geist" | "roboto";
	website?: { label: string; url: string };
}) {
	return (
		<footer
			data-share-font={shareFont}
			data-workspace={workspace || undefined}
			className="source-credit flex flex-wrap justify-center gap-x-2 gap-y-1 border-t border-gray-5 px-4 py-4 text-center"
		>
			{workspace && <span>omashare ·</span>}
			{website && (
				<span>
					<a href={website.url}>{website.label}</a> ·
				</span>
			)}
			<span>
				Built on <a href="https://github.com/CapSoftware/Cap">Cap</a> (AGPL) ·
			</span>
			<a href="https://github.com/riopierrefrancois/omashare">Source code</a>
		</footer>
	);
}
