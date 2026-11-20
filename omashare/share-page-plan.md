# OmaShare share page: comments under the video, guest comments

Plan file: `omashare/share-page-plan.md`. Branch `omashare/share-page` in PF's Cap fork (`~/src/cap`). Approved by PF on 2026-11-20.

## What PF wants

- **Comments under the video**, one after another, laid out like the notes on a Workhive card page. Each comment is a rounded card. Replies sit inside that card as bubbles. **Newest comment first**, and the box to write one sits at the bottom.
- **The side panel keeps only Summary and Transcript.** Each tab appears only when it has something in it. If neither has anything, there's no side panel and the video takes the full width.
- **Guests can comment and reply with just their name.** No account needed.
- Words on screen are plain everyday language. Say "comment" and "reply", not "activity" or "thread".

Only the **Player** (classic) view changes. The **Timeline** view (`?view=timeline`, `TimelineView.tsx`) stays as it is, apart from the type changes it needs to build.

## Look and feel reference (copy the look, not the code)

Workhive, in `~/BeastCode/workhive/src/components/simple/companions/notes/`:
- `note-card.tsx` is the root card: `rounded-2xl border px-3 py-2`, white. The header has the face, the bold name, the time in small grey text, and `•••` on the right. Then the words. The footer has a quiet grey **Reply** and "N replies".
- `note-thread.tsx`: the replies sit inside the same card, under a top border (`border-t pt-3`). Only the latest 2 show, with "Show N earlier replies" above them. One level deep: replying to a reply answers the root.
- `reply-bubble.tsx`: the face sits outside a soft bubble (`rounded-2xl border px-3 pb-2 pt-1.5`, page-grey background). Inside the bubble are the name, the time and the words. **Reply** sits under the bubble.

Use Cap's own Tailwind tokens (`gray-1…gray-12`, `bg-white`, `border-gray-5`, and so on) and its existing avatar component. Do not import anything from Workhive.

## Rules for the implementer

- Read `AGENTS.md` first. Its rules apply: tabs, double quotes, Biome-clean, no hand-edited migration SQL, no `Co-authored-by` trailers.
- **The dev site is already running** at http://localhost:3001 (Herdr tab "OmaShare dev"), with the database at 127.0.0.1:3306 through the root `.env`. Do not start, stop or restart servers or Docker.
- **Do not apply migrations** (`db:push`, `db:migrate`, or SQL against the database). Generate them (`bun run db:generate` in `packages/database`) and commit. The orchestrator applies them.
- One commit per task, with a message like `share page: <what>`. Tick the task's box in this file in the same commit.
- Stop at each phase gate and report: the commits, the gate output, and anything this plan got wrong. Do not start the next phase.

---

## Phase A: guest comments (server and types)

### Task A1: schema
- [x] In `packages/database/schema.ts`, `comments`:
  - Make `authorId` nullable (`nanoIdNullable`). It is null for a guest comment.
  - Add `guestName: varchar("guestName", { length: 80 })`, nullable. It holds the name a guest typed. It is null for signed-in authors.
- [x] Run `bun run db:generate` from `packages/database`. Commit the schema change together with the generated SQL, snapshot and journal. Name the migration so it reads as OmaShare's (for example `--name omashare_guest_comments` if drizzle-kit allows it).
- [x] Update the comment types in `packages/web-domain` (and anywhere `CommentType` is declared) so `authorId` can be null and `guestName?: string | null` exists.

### Task A2: posting as a guest (`apps/web/actions/videos/new-comment.ts`)
- [x] A signed-in user posts exactly as today.
- [x] With no user, accept a **text** comment or reply only if all of these hold. Otherwise throw an `Error` with a plain message.
  - `guestName`, trimmed, is 1–80 characters. Otherwise: "Please add your name."
  - The honeypot field `website` is empty. Otherwise fail quietly with the same generic error the action already uses.
  - The type is `"text"`. Guests can't leave emoji reactions or media comments: "Sign in to react."
  - The existing checks still pass: the video exists and is viewable through `Policy.withPublicPolicy`, comments aren't disabled, and the reply parent is on this video.
  - Rate limit with `isRateLimited(RATE_LIMIT_IDS.COMMENT_CREATE, { key: \`comment:guest:${ip ?? "unknown"}\` })`. Get `ip` from `getClientIp` (`lib/client-ip.ts`) using the request headers (`next/headers`).
- [x] Insert with `authorId: null` and `guestName`. Return the comment with `authorName = guestName`.
- [x] The notification to the video owner still fires, naming the guest. Make `lib/Notification.ts` handle a null `authorId`: use `guestName` for the name, and leave out anything that needs an author account.

### Task A3: reading and deleting guest comments
- [x] Every read of `comments.authorId` must handle null, and the author name shown is `users.name ?? comments.guestName ?? "Guest"`. The files are listed below. Re-check with `grep -rn "comments.authorId" apps packages`.
  `actions/videos/delete-comment.ts`, `app/api/upload/[...route]/comment-media.ts`, `app/api/video/comment/delete/route.ts`, `app/api/mobile/[...route]/route.ts`, `app/api/v1/[...route]/route.ts`, `app/embed/[videoId]/page.tsx`, `app/s/[videoId]/page.tsx`, `lib/Notification.ts`, `lib/agent-write.ts`.
- [x] A guest comment can be deleted only by people who can already delete others' comments on that video (the owner and the existing org rules). Nobody can delete it "as its author".
- [x] Unit tests (vitest, next to the existing ones in `apps/web/__tests__/unit/`):
  - A guest comment needs a name.
  - The honeypot is refused.
  - A guest emoji or media comment is refused.
  - A guest reply to a comment on another video is refused.
  - A guest comment shows the guest's name.
  - The owner can delete a guest comment.
  Follow the repo's test rules (AGENTS.md "Tests").

### Phase A gate
`bun run biome check --write` on the touched files, `bun run typecheck`, and `cd apps/web && bunx vitest run <the touched and new test files>`. All green. Then stop and report.

---

## Phase B: the share page layout (`apps/web/app/s/[videoId]/`)

### Task B1: side panel only for Summary and Transcript
- [x] In `Sidebar.tsx`, the tabs are **Summary** and **Transcript** only. The Comments/"activity" tab and the views header leave the panel.
- [x] A tab shows only when it has content:
  - Summary: summaries aren't disabled and there's an `aiData.summary`, or chapters aren't disabled and `aiData.chapters` has items.
  - Transcript: transcripts aren't disabled and `transcriptionStatus === "COMPLETE"`.
- [x] The first available tab is the default. With one tab, show its title, not a one-item tab bar.
- [x] In `Share.tsx`, with no tab available, the side panel (`<aside>`) and its collapse button don't render, and the video column fills the width. A tab can appear later while the page is open, because the status polling already updates `aiData` and `transcriptionStatus`. The panel then appears.
- [x] Remove the `SummaryChapters` block under the video in the Player view. The Summary tab already shows the summary and chapters.

### Task B2: comments section under the video
- [x] New `_components/comments/ShareComments.tsx` (plus small pieces next to it). It renders in the Player view under the video and the reactions toolbar, in the video column, at the same max width as the video.
- [x] On narrow screens the order is: video, comments, then Summary/Transcript.
- [x] Header: **Comments** with the count of text and media comments, replies included. For the owner and members, the views, comments and reactions numbers that used to sit in the panel header go on the right of this line.
- [x] Reuse the existing state and handlers that `Share.tsx` passes to `Sidebar` today (`commentsData`, `setCommentsData`, `optimisticComments`, `setOptimisticComments`, `handleCommentSuccess`, delete). Move logic out of `tabs/Activity/Comments.tsx` instead of duplicating it. Delete files that end up unused.

### Task B3: comment cards (Workhive look)
- [x] Root comments (text, video or audio; no emoji) are sorted **newest first** by `createdAt`.
- [x] Card: a rounded white card with a border.
  - Header: face, bold name, relative time. If the comment has a `timestamp`, add a small chip **at 0:42**; clicking it seeks the video (`onSeek`).
  - `•••` on the right for whoever can delete the comment.
  - Then the words. A media comment keeps its existing player.
  - Footer: quiet grey **Reply** and "1 reply" or "N replies".
- [x] Replies sit inside the card under a top border, oldest to newest, as bubbles in the `reply-bubble.tsx` style.
  - Only the latest 2 show, with **Show N earlier replies** above them and **Show fewer replies** once expanded.
  - **Reply** under a bubble opens the reply box for the root comment, saying "Replying to Sam". Every reply's parent is the root, one level deep.
- [x] The reply box opens at the bottom of that card, with **Send** and **Cancel**, and the same guest-name rule as B5.
- [x] Delete: `•••` → **Delete** → inline question "Delete this comment and its 2 replies? It can't be undone." (or "Delete this reply? It can't be undone."), with **Yes, delete** and **Keep**. No modal.

### Task B4: reactions
- [x] Emoji reactions don't appear as cards.
- [x] Under the reactions toolbar, a compact row shows each emoji used with its count, for example `😂 2  👍 1`. Hovering shows who reacted (a `title` is enough). Hide the row when there are no reactions.
- [x] The toolbar and the reaction stamps on the video timeline don't change.

### Task B5: the comment box (bottom of the section)
- [ ] A text box with placeholder "Write a comment at 1:13…", using the video's live current time. Above or inside it, a chip **at 1:13** with ✕ to comment without a time. That decides whether `timestamp` is sent.
- [ ] Enter sends and Shift+Enter makes a new line, unless the existing composer does it differently (then keep that). Send is disabled while the box is empty or sending.
- [ ] **Signed in:** their face, and the media record buttons exactly where `canRecordMedia` allows them today.
- [ ] **Guest:** a **Your name** field. It is shown only until a name is saved, and the name is kept in `localStorage["omashare.guestName"]`. Once saved, show "Commenting as Sam · Change". There's also a hidden honeypot input named `website`, which a person never sees or fills.
- [ ] Guests no longer get the sign-in overlay (`AuthOverlay`) when commenting or replying. Keep it only for things guests still can't do (media comments).
- [ ] After sending, the new card appears at the top (optimistically, as today). The page scrolls it into view and flashes a ring for about 1.5 s. The box empties. On error, the words stay in the box and a toast says why (in the server's plain message).
- [ ] With comments turned off: the section shows "Comments are turned off for this video." and no box.
- [ ] No comments yet: "No comments yet. Be the first." above the box.

### Phase B gate
Biome on the touched files, `bun run typecheck`, and vitest for the touched and new tests. Add component tests where the repo already tests share page components:
- The tab rules in B1, including no panel when there's no tab.
- Newest-first order.
- The 2-reply window.
- The guest name being remembered.

Then stop and report. The orchestrator then checks the page in the browser at http://localhost:3001/s/<id> as the owner and as a signed-out guest.
