const productPrefixes = new Set([
	".well-known",
	"_next",
	"_proxy",
	"admin",
	"api",
	"c",
	"checkout",
	"cli",
	"dashboard",
	"deactivate-license",
	"dev",
	"dpa",
	"embed",
	"install-cli.cmd",
	"install-cli.ps1",
	"install-cli.sh",
	"invite",
	"login",
	"mcp",
	"messenger",
	"mobile",
	"onboarding",
	"openapi.json",
	"privacy",
	"r",
	"redeem",
	"s",
	"signup",
	"terms",
	"verify-otp",
]);

const metadataPaths = new Set([
	"/favicon.ico",
	"/icon.svg",
	"/apple-icon.png",
	"/robots.txt",
	"/sitemap.xml",
]);

export function productRedirect(pathname: string, signedIn: boolean) {
	const segment = pathname.split("/")[1] ?? "";
	if (metadataPaths.has(pathname)) return null;
	if (
		productPrefixes.has(segment) &&
		(!segment.includes(".") ||
			segment.startsWith(".") ||
			pathname === `/${segment}`)
	)
		return null;
	return signedIn ? "/dashboard" : "/login";
}
