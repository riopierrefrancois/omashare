# OmaShare: signed-in share page and a tidy dashboard (Phase F)

Branch `omashare/share-page`. When this branch is pushed to `main`, it deploys share.dufety.com. PF approved the designs on 2026-11-21.

## The designs (local reference files, not in git)

- `omashare/design/OwnerSheet.dc.html` is the **share page as its owner sees it**. It's the same page viewers see (`WorkhiveSheet.dc.html`, already built in Phase E), plus one quiet row of owner tools above the sheet. The ⋯ menu is drawn open.
- `omashare/design/DashboardV2.dc.html` is **My videos**: a slimmer sidebar and no top bar.

The inline styles in those files are the spec. Translate them to Tailwind and Cap's components. Do not paste the HTML.

## Rules for the implementer

These are the same as in `omashare/rebrand-plan.md`:

- `AGENTS.md` applies.
- The dev site is already running at http://localhost:3001.
- Don't start or stop servers or Docker.
- No migrations.
- One commit per task, with its box ticked in the same commit.
- Stop at the gate and write a report.
- Use plain everyday words in the UI.
- Never commit anything from `omashare/design/`.
- **Hide, don't delete.** When a Cap feature leaves the UI, remove its button or link and leave its code and routes in place, unless the task says otherwise. Keep every working feature reachable from somewhere.

---

## Phase F

### Task F1: owner tools on the share page (`/s/[videoId]`)

Today, `ShareHeader.tsx` puts these above the title:

- "My Caps", "Change logo", "Move to folder or space"
- a privacy dropdown, a blue Share button, "Edit video", "View analytics" and "Manage video"

Replace them with the design's single row. The row sits **above the white sheet, on the page color**, only for the owner and for members who can manage the video today:

- [x] Left: **← My videos**, using the existing `DashboardBackLink` destination.
- [x] Right:
  - "Only you see this row" in small dim text. Show it only to the owner.
  - **Who can watch**: an outlined 36 px button showing the current setting (e.g. "Anyone with the link"). It opens the existing sharing and access control, which now absorbs the old blue Share button.
  - **Download**: an outlined button that runs the existing download.
  - **⋯**: an outlined 36 px icon button.
- [x] The ⋯ menu offers these items, in this order. Each one opens the existing dialog or action:
  1. **Trim or cut the video**: the existing `/s/[id]/edit` editor. First check in the browser that the editor loads and saves on this setup (local :3001). If it doesn't, leave this item out and say so in the report.
  2. **Change thumbnail**
  3. **Move to a space**
  4. **Add a password**, or **Change password** when one is set
  5. **Views and reactions** (the analytics page), with the view count as a dim hint on the right, after a separator
  6. **Video settings**
  7. **Delete video** in `accentText` red, after a separator

  Keep the call-to-action item only if it works today, placed under Video settings. Drop "Duplicate" if it's there.
- [x] Under the title:
  - A small **pencil** button (36 px, dim) next to the title starts renaming. Inline title editing already exists; keep it.
  - The owner line becomes `avatar · name · date · length · N views`. "N views" is a blue link (`#4F75FE`) to the analytics page. Show it only to the owner and members.
- [x] Remove these from the share page for everyone:
  - "Change logo" (the logo lives in Settings)
  - the black **Comment** button with the `C` key chip, under the video. The C shortcut can stay if it focuses the comment box.
  - the stats row above the comments (eye / bubble / smiley counts and "Analytics")
- [x] Guests see no change from Phase E, apart from F2's reactions and F3.

### Task F2: reactions and the comments header

- [x] Replace the six emoji buttons under the video with the design's reaction buttons:
  - 👍 and ♥ as outlined 40 px buttons with their counts, plus a quiet **+ React** button that opens the full emoji set (the existing picker or list).
  - Existing reactions keep working and counting. Any emoji other than 👍 or ♥ that has reactions shows as its own button with its count.
- [x] Move the **Player / Timeline** toggle into the comments header, on the right, as a small segmented control labelled **List / On the timeline** (32 px). Remove the old toggle under the video. Both views behave exactly as they do today.
- [x] In the comment box, hide the screen, camera and microphone buttons (recorded comments), for everyone. Leave the media-comment code in place, and keep showing existing recorded comments if any exist.
- [x] For a signed-in person, the box reads "Commenting as **Name**", with no Change button. Guests keep the Change button.

### Task F3: one footer size

- [x] `components/SourceCredit.tsx`: in the current build, "Cap" and "Source code" render bigger, and in a different face, than the rest of the footer (see PF's screenshot: the links pick up a global link style). Make every part of the footer the same size and face:
  - share pages: the brand font at 12 px, color `#767676`-like dim
  - signed-in pages: Geist Mono 12 px, dim

  Links are underlined on hover only.

### Task F4: My videos chrome (`DashboardV2.dc.html`)

- [x] **No top bar** on the My videos page:
  - Remove the "Search caps, spaces, settings… Ctrl K" bar. If Ctrl K search is used elsewhere, keep it working from the keyboard, with no visible bar.
  - The page's own search field ("Search your videos", with a `/` key hint) is the only search box.
  - The bell and the account menu move to the **bottom of the sidebar** (see the design): avatar, name, bell with an unread dot, and ⋯ for the account menu.
- [x] **Sidebar** (232 px):
  - the OmaShare mark
  - an organization switcher button: logo, name and up/down chevron, with **no** "No custom domain set" line and **no** member avatar row ("P + + +")
  - nav: **My videos** (count), **Views and reactions** (the analytics page), **Settings** (organization settings)
  - "Spaces" with + and the spaces list. Rename "All Workhive"-style entries to "Everyone at <org>". Hide "Browse spaces" unless the person has more spaces than are listed.
  - Remove **Record a video** (Cap's desktop download) and **Import Media** (the same as Upload; the Upload button already covers it) from the nav. Leave their routes in place.
- [x] **Header row:** `My videos 3`, then search, an outlined **New folder** and a filled **Upload**, in that order on the right.
- [x] **Grid:**
  - Remove the select-all checkbox row and the "15 per page" picker.
  - A selection checkbox appears on a card only on hover, or once something is selected. Selecting still opens the existing selected-videos bar.
  - Pagination shows at the bottom only when there are more videos than fit on one page (keep 15 per page).
- [x] The same sidebar and chrome apply to the other dashboard pages (analytics, settings, spaces, folders). Those pages keep their content.
- [x] Remove every user-visible "Cap"/"Caps" left in the dashboard chrome and in the My videos page (e.g. "Search caps").

### Task F5: no Cap logo while videos load (added after the gate check)
- [x] `LogoSpinner` from `@cap/ui` is Cap's logo spinning. It still shows on kept pages: `components/VideoThumbnail.tsx` (a card waiting for, or missing, its thumbnail), `UploadPlaceholderCard.tsx`, `CapVideoPlayer.tsx`, `HLSVideoPlayer.tsx` and `RecordingInProgress.tsx`. Replace it there with a plain, brand-free spinner: a thin ring in the current text color, or the accent on share pages. Don't change `@cap/ui`.
- [x] A card whose thumbnail fails to load, or that has none, shows a quiet neutral tile (light grey, with a small outlined play glyph in dim grey), never a black box with a spinner that runs forever.

### Phase F gate

- Biome on the touched files, `bun run typecheck`, and vitest for the touched and new tests.
- New or updated tests:
  - The owner row shows for the owner and is absent for guests.
  - The ⋯ menu items are in the planned order.
  - Recorded-comment buttons are hidden.
  - Reactions: 👍/♥ always show, and other emojis show only when counted.
  - The sidebar has no Record or Import items.
- Check in the browser at http://localhost:3001 at 1280 px, as owner and as a guest. Say what you checked and what you couldn't.
- Stop and report to the path the orchestrator gives.
