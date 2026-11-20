# OmaShare rebrand: branded share pages, OmaShare dashboard, no Cap marketing

Branch `omashare/share-page` (pushes to `main` deploy share.dufety.com). PF approved the designs on 2026-11-20.

## The designs (local reference files, not in git)

`omashare/design/` (each is one HTML file; open it in a browser):
- `WorkhiveSheet.dc.html` is **the share page**. It shows an organization brand: Workhive's logo, colors and website.
- `WorkhivePlatformPhone.dc.html` is the share page on a phone. Use its layout (pinned comment box, Summary behind a button), with the same rules as `WorkhiveSheet`: replies have no Reply button, timestamps are chips placed after the time, and the box has an accent outline.
- `ModernLogin.dc.html` is the sign-in page (OmaShare brand).
- `ModernDashboard.dc.html` is "My videos" (OmaShare brand, light by default).

Inline styles in those files are the spec for spacing, sizes, radii and colors. Translate them to Tailwind and Cap's components. Do not paste the HTML.

## The idea

- **Share pages (`/s/[videoId]`, `/embed/[videoId]`) wear the video's organization brand**, never OmaShare's and never Cap's. A brand is: the organization's name and logo (both exist in Cap today), plus new settings for accent color, text color, page color, font (Roboto or Geist) and website (label and URL).
  - With no brand set, the share page uses the neutral defaults: white page, ink `#1F2335`, accent `#2959C4`, Geist, no website button.
  - The brand lives in `organizations.settings` (JSON). No schema migration.
- **Everything only signed-in people see wears OmaShare:** sign in, dashboard and settings. That means the lowercase `omashare` wordmark in Geist Mono, the outlined play glyph, and Geist. The glyph is the SVG in `ModernLogin.dc.html`.
- **Cap's marketing site goes away.** That covers the home page, pricing, download, blog, docs, black-friday, features, tools, seo pages, testimonials and so on. Visiting any of those redirects to `/dashboard`, or to `/login` when signed out. `/` does the same.
- **The only Cap credit left is the AGPL footer** on share pages: `<website label> · Built on Cap (AGPL) · Source code`. "Cap" links to github.com/CapSoftware/Cap and "Source code" links to github.com/riopierrefrancois/omashare. When the organization has no website, its part is left out. On OmaShare pages, the footer is `omashare · Built on Cap (AGPL) · Source code`.

## Rules for the implementer

Same as `omashare/share-page-plan.md`:
- `AGENTS.md` rules apply.
- The dev site is already running at http://localhost:3001.
- Don't start or stop servers or Docker.
- No migrations.
- One commit per task, with its box ticked in the same commit.
- Stop at each gate and write a report.
- Plain everyday words in the UI.
- Never commit anything from `omashare/design/`.

---

## Phase D: routes, brand settings, OmaShare chrome

### Task D1: inventory, then remove the marketing site
- [x] Write `omashare/route-inventory.md`. List every route group and top-level route under `apps/web/app`, each marked **keep** (the product needs it) or **drop** (marketing or docs). Keep `/s`, `/embed`, `/login`, sign-up/verify routes, `/dashboard`, `/onboarding`, `/invite`, `/api`, `/c` if the product uses it, `robots.ts`, `sitemap.ts`, and everything Next needs. Anything you're unsure of goes under keep, with a note.
- [x] In the existing proxy/middleware (`proxy.ts`), redirect every **drop** path to `/dashboard`, or to `/login` when signed out. Use a 307, so nothing is cached for good. `/` behaves the same.
  - `robots.ts`: disallow everything except `/s/` and `/embed/`.
  - `sitemap.ts`: empty.
  - Do not delete the route files in this task.
- [x] Remove links into dropped pages from kept pages:
  - the "Get Cap free"/"Log in" signed-out nav on the share page (`ShareHeader.tsx`, `SIGNED_OUT_LINKS`)
  - "Download Cap"
  - "Cap Pro" / "Upgrade" upsell cards and buttons in the dashboard
  - links to docs, pricing and so on

### Task D2: organization brand settings
- [x] Add a typed `brand` object to `organizations.settings`: `accent`, `ink`, `page` (hex strings), `font` (`"roboto" | "geist"`), `websiteLabel`, `websiteUrl`. All optional.
  - Validate hex values and https URLs on the server.
  - Derive two extra colors in one helper:
    - `accentText`: the accent darkened until it reaches 4.5:1 contrast on white.
    - `accentSoft`: a tint for chips. Use the page color mixed with the accent, or `#F9ECDE`-like for warm accents. Keep it simple and document the formula.
- [x] In the dashboard, under the organization settings, add a **Share page look** section:
  - color pickers (or hex fields) for accent, text and page
  - font choice
  - website label and URL
  - a small live preview: a header with the logo and name, and one comment card
  - It saves through the existing settings action. Only owners and admins can change it.
- [x] `lib/share-branding.ts` returns the full brand, with defaults filled in, for `/s` and `/embed`.

The brand preview computes chip colors by mixing 12% accent with 88% page color, channel by channel. Accent text mixes the accent with black in one-percent steps until it reaches a 4.5:1 contrast ratio on white.


### Task D3: OmaShare chrome for signed-in pages
- [x] Load Geist and Geist Mono with `next/font/google`, and Roboto for share pages that pick it.
- [x] Add an `OmaShareMark` component (glyph plus `omashare` wordmark) and use it wherever Cap's logo shows on signed-in pages.
  - Favicon and app icons become the glyph.
  - Page titles: `<page> · omashare` on signed-in pages, and `<video title> · <organization name>` on share pages.
- [x] Restyle the **sign-in** (and verify-code) pages to `ModernLogin.dc.html`. The "only @domain addresses" line reads `CAP_ALLOWED_SIGNUP_DOMAINS` and is hidden when that's unset.
- [x] Restyle the **My videos** grid page to `ModernDashboard.dc.html`: header, search, Upload button, and video cards with copy link. The rest of the dashboard (settings, spaces) only gets the new mark and fonts in this phase, not a full redesign.
- [x] Remove every user-visible "Cap" word from kept pages. Use "video" where Cap says "Cap" (e.g. "My Caps" becomes "My videos", "Cap Recording" becomes the organization name). Leave "Cap" only in the AGPL footer and in code identifiers.

### Phase D gate
- Biome on the touched files, `bun run typecheck`, and vitest for the touched and new tests.
- New tests for:
  - the redirect allow-list (a kept path passes, a dropped path redirects, `/` redirects)
  - the brand defaults and color helpers
  - only admins can save the brand
- Stop and report to `/tmp/omashare-phase-d-report.md` (or the scratch path the orchestrator names).

---

## Phase E: the branded share page

### Task E0: leftovers from the Phase D browser check
- [x] The dashboard sidebar still shows a **Cap Pro: Unlimited shareable links** card. Remove it and any other Pro/upgrade card in the sidebar or settings.
- [x] Videos uploaded from the dashboard are named "Cap Upload - 20 November 2026". Use the file name without its extension; fall back to "Upload, 20 November 2026".
- [x] Organization settings now have two colors: Cap's old **Brand color** (play button, progress bar, focus rings) and the new **Share page look** accent. Merge them into one:
  - The accent drives the player too.
  - Hide the old Brand color field.
  - When an organization has the old one set and no accent, use it as the accent.

### Task E1: layout (desktop)
- [x] Rebuild the Player view of `/s/[videoId]` to `WorkhiveSheet.dc.html`, using the brand from D2:
  - **Header:** 60 px; organization logo and name; an outlined **Copy link** button (40 px); the website button (40 px, filled accent, white text) only when `websiteUrl` is set.
  - **One white sheet:** title (28 px bold), owner line, video (rounded 12), reactions row.
  - **Comments area** below a 2 px border line, on a tint that is half the page color over white. Use the page color at 50% opacity over white, like Workhive's `bg-background-primary/50`.
  - **Summary/Transcript** as their own white sheet on the right, with the existing visibility rules from `share-page-plan.md` B1.
  - **Footer** at the bottom of the screen (`min-h-screen` flex column), centered, as described in "The idea".
  - Owner and member tools (edit title, privacy, analytics, manage) stay. Restyle them quietly to match, and move them so they don't crowd the header.
- [x] The Timeline view keeps its own layout, with the same header, footer, colors and the comments section below (from Phase C).

### Task E2: comments
- [ ] Cards follow `WorkhiveSheet.dc.html`:
  - 32 px avatar vertically centered with the name and time.
  - The timestamp is a chip right after the time: soft tint background, `accentText` color, Geist Mono, `▶ 2:31`.
  - **Reply** (no icon) in blue `#4F75FE` under each comment.
  - Replies sit inside the card under a 1 px line, as bubbles with the avatar outside, on the page color.
- [ ] **One level only:** remove the Reply button under replies. A reply's parent is always a top-level comment. In `actions/videos/new-comment.ts`, refuse a `parentCommentId` that is itself a reply ("You can only reply to a comment."), for guests and signed-in users alike.
- [ ] The comment box follows the design: 1.5 px accent outline, no inner border on the text area, "Commenting as Alex · Change" (Change in `accentText`), the `at 1:13 ✕` chip, and an accent **Send**.

### Task E3: phone
- [ ] Below 640 px, follow `WorkhivePlatformPhone.dc.html`:
  - a 52 px header with an icon-only copy-link button (44 px)
  - video, title, reactions and a **Summary** button that opens summary and chapters in a sheet
  - comment cards
  - the comment box pinned to the bottom, with a 44 px field and Send

### Phase E gate
- Biome, typecheck and vitest, including tests for:
  - nested replies are refused
  - no Reply under replies
  - brand colors applied, and defaults when there's no brand
  - the website button only when set
- Stop and report. The orchestrator then checks the page in the browser at 1280 px and 390 px, branded and unbranded, as owner and guest.
