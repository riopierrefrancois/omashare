# Web route inventory

| Route group | Decision | Routes |
| --- | --- | --- |
| `(org)` | Keep | `/dashboard`, `/invite`, `/login`, `/onboarding`, `/signup`, `/verify-otp` |
| `(infra)` | Keep | `/dashboard/infra` and its product routes |
| `(black-friday)` | Drop | `/blackfriday` |
| `(docs)` | Drop | `/docs` |
| `(infra-post)` | Drop | `/blog/introducing-cap-infra` |
| `(infra-site)` | Drop | `/infra`, the public product pitch and its text variants |
| `(site)` | Drop | `/`, `/about`, `/agents`, `/blog`, `/changelog`, `/download`, `/faq`, `/features`, `/home`, `/oss-friends`, `/pricing`, `/self-hosting`, `/student-discount`, `/support`, `/testimonials`, `/tools`, and the marketing catch-all `/[slug]` |
| `(site)/(seo)` | Drop | `/async-video-code-reviews`, `/best-screen-recorder`, `/developer-documentation-videos`, `/free-screen-recorder`, `/google-chrome-screen-recorder`, `/google-drive-screen-recorder`, `/hipaa-compliant-screen-recording`, `/how-to-screen-record`, `/loom-alternative`, `/mac-screen-recording-with-audio`, `/migrate-from-loom`, `/open-source-screen-recorder`, `/record-screen`, `/screen-recorder-mac`, `/screen-recorder-windows`, `/screen-recorder`, `/screen-recording-software`, `/screen-recording`, `/self-hosted-screen-recording`, `/solutions`, `/video-recording-software` |
| `(site)` exceptions | Keep | `/checkout`, `/deactivate-license`, `/redeem`, `/dpa`, `/privacy`, `/terms` for billing, existing licenses, and legal obligations |

| Top-level route | Decision | Purpose |
| --- | --- | --- |
| `/.well-known` | Keep | OAuth, workflow, and API discovery |
| `/admin` | Keep | Internal video recovery and processing |
| `/api` | Keep | Product APIs and integrations |
| `/c` | Keep | Shared collections |
| `/cli`, `/mcp` | Keep | Product authorization |
| `/dev` | Keep | Developer video playback |
| `/docs-markdown`, `/infra-markdown` | Drop | Marketing and documentation text routes |
| `/embed`, `/s` | Keep | Video playback, sharing, and editing |
| `/install-cli.cmd`, `/install-cli.ps1`, `/install-cli.sh` | Keep | CLI setup |
| `/messenger` | Keep | Existing video conversations |
| `/mobile` | Keep | Mobile checkout return |
| `/openapi.json` | Keep | Machine-readable product interface |
| `/robots.txt`, `/sitemap.xml` | Keep | Crawler metadata |
| `/r` | Keep | Existing product rewrite |
| `/_next`, metadata icons, and public assets | Keep | Framework and product resources |
| `/_proxy/dub` | Keep | Existing referral tracking |
| `/roadmap`, `/obs-alternative`, `/updates` | Drop | Old marketing aliases |

`Layout`, `lib`, `utils`, and the root layout, global styles, and error files are app support code with no public routes.
