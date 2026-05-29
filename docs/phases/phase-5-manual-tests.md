# Phase 5 — Manual Test Plan (Visual + Real-Device only)

> **Scope:** this doc covers ONLY what an automated test cannot do — real
> browser rendering, real device, real iframe playback, watermark
> animation, PDF rendering inside a WebView, native pickers, screenshot
> blocking, cold-start budget. Every functional/data behavior has already
> been auto-verified by me on this dev project (orqwyazvcthgxoadfxfv).
>
> **Already proven by automated tests (do NOT re-test):**
> - All 5 Phase 5 migrations applied + schema/policies/triggers/indexes
>   queried via `information_schema` / `pg_policies` / `pg_indexes` /
>   `pg_proc`.
> - All 9 Phase 5 edge fns deployed, ACTIVE, verify_jwt=true.
> - `pnpm test:content` — 25/25 (URL parser, ISO duration, watermark
>   formatter, playback HMAC roundtrip).
> - `pnpm smoke:content-rls` — 7/7 RLS scenarios across PostgREST: batch-A
>   student sees A+coursewide only; batch-B student sees B+coursewide only;
>   teacher sees A+coursewide only; anon sees 0; student writes to
>   content_items blocked; student writes own video_progress; spoof for
>   another student blocked.
> - `pnpm smoke:content-fns` — **30/30 assertions covering every Phase 5
>   edge fn including audit_log rows for publish/unpublish/promote/
>   unpromote/delete AND that yt-playback-sign watermark string equals
>   formatWatermark(full_name, phone) for the test student.**
> - `pnpm typecheck` + `pnpm lint` — all workspaces green.
> - `pnpm test --filter @fynestudy/mobile` — 6 suites / 53 tests green.
> - Supabase security advisor sweep — only Phase-1 backlog item remains.
>
> So you DON'T need to verify: filter logic, search filtering at the data
> layer, RLS scoping, publish/promote/delete state transitions, audit_log
> rows, watermark text format, signed URL generation, file existence
> verification, dup detection, oversize rejection, YouTube URL parsing.
> Those are mathematically proven by the smoke runs above.
>
> What you DO need to verify in this doc: that the UI **renders** the
> verified data correctly, the player iframe **plays** real video, the PDF
> WebView **renders** a real PDF, watermark text is **visible** on screen,
> and the watermark rotation **animates** every 60 seconds.

---

## 0. One-time setup

### 0.1 Fresh fixtures

```
pnpm seed:content-manual-test
```

Copy the printed block to a scratch file. You'll need:
- Course id + topic ids
- Batch A id + Batch B id
- Teacher email + password
- Student 1 + Student 2 (Batch A) email + password
- Student 3 (Batch B) email + password

Expected watermark text (the seed sets known phone numbers):

| User | Watermark text |
|---|---|
| Student 1 | `P5 • ••1001` |
| Student 2 | `P5 • ••2002` |
| Student 3 | `P5 • ••3003` |

The seed also creates 5 content rows (3 visible to S1/S2, 2 visible to S3,
1 unpublished hidden from everyone). Visibility map is in the script
output.

### 0.2 Owner admin

```
Email      owner@fynestudy.example.com
Password   FyneStudy01     (or your Phase 2 password)
TOTP       (your enrolled secret)
```

Admin URL: <https://fyne-study-app-admin.vercel.app/>

If Vercel still shows the Phase 1 placeholder:

```
pnpm --filter @fynestudy/admin dev
```

…use <http://localhost:3000/>.

### 0.3 Metro clean restart (NON-NEGOTIABLE)

Phase 5 adds 4 new top-level routes, 2 deep tab screens, 3 new components.
Hot-reload **cannot** propagate these. Every test session:

```
1. Ctrl+C in Metro terminal.
2. Force-quit Expo Go (iOS: swipe Expo Go card UP. Android: swipe away.)
3. pnpm dev:mobile -- --clear     ← the wrapper, with --clear.
4. Open Expo Go from the HOME-SCREEN icon (not recents).
5. Scan the QR.
6. Metro log MUST say "(NNNN modules)" with N in thousands.
   If it says "(1 module)" the cache didn't clear — go back to 1.
```

### 0.4 Phase 5 added these deps — make sure they installed

```
react-native-webview    13.15.0
react-native-youtube-iframe   2.4.1
expo-document-picker    14.0.7
expo-file-system        19.0.22
expo-screen-capture     8.0.7
```

If you get `Native module "RNCWebView" was not found`, re-run
`pnpm install` and do the clean restart again.

### 0.5 Video playback prep

The seed inserts placeholder YouTube IDs that won't actually play. For
the §D player tests, override ONE row with a real public YT id:

In Supabase SQL editor (project `orqwyazvcthgxoadfxfv`):

```sql
update public.content_items
   set yt_video_id = 'dQw4w9WgXcQ', duration_sec = 213
 where title = 'Intro to Projectile Motion (Batch A only)';
```

(`dQw4w9WgXcQ` is the famous Rick Astley video — public, always
playable.)

---

## A. Admin `/content` moderation — visual layout (browser)

You're verifying the page LOOKS right and clicks DO things. The data
side is already proven.

### A1. Nav item present

```
1. Open admin, sign in.
2. Left sidebar should show NINE entries:
      Overview · Students · Teachers · Admins (Phase 11) · Batches
      Courses · Attendance · Content · Audit log (Phase 11)
3. "Content" is a real link (not greyed).
4. Click "Content". URL goes to /content.
```
**Report:** "A1 ok" or which item is missing/mislabeled.

### A2. Page layout

```
1. Title: "Content library"
2. Subtitle: "Moderate uploads · promote to course-wide · publish /
   unpublish."
3. Filter card with 5 controls + Export button on the right:
      Course | Batch | Kind | Status | Search box | [Export CSV]
4. Below: table header
      Title · Kind · Path · Scope · Uploader · Status · Created · Actions
5. Five seeded rows appear (filter Course = P5_TEST_…  if list is long):
      Intro to Projectile Motion       VIDEO  P5 Batch A    Published
      Newton's Laws (Batch B only)      VIDEO  P5 Batch B    Published
      Kinematics Formula Sheet          PDF    course-wide   Published
      Pending review …                  PDF    P5 Batch A    Pending  ← amber
      Lecture notes — Batch A           NOTE   P5 Batch A    Published
6. "course-wide" pill is GREEN. Batch pills are GREY.
   "Published" pill is GREEN. "Pending" pill is AMBER.
```
**Report:** "A2 ok — pills colored correctly".

### A3. Filter + search — UI reaction only

```
1. Course = P5_TEST_<your-ts>  →  table narrows to your 5 seed rows.
2. Add Kind = PDF → 2 rows shown.
3. Add Status = Unpublished → 1 row ("Pending review …").
4. Clear all filters → back to full list.
5. Type "Newton" in Search → press Enter → "Newton's Laws" only.
6. Clear search.
```
**Report:** "A3 ok — UI updates per filter".

### A4. Publish toggle button flip

```
1. Find the "Pending review" row.
2. Click "Publish".
3. Page reloads. Status pill flips from amber "Pending" to green "Published".
4. The button text flips to "Unpublish".
```
**Report:** "A4 ok — button + pill flip on click".

### A5. Promote course-wide button flip

```
1. Find "Lecture notes — Batch A".
2. Click "Promote course-wide".
3. Scope pill flips from grey to green "course-wide".
4. The button cluster changes — "Promote course-wide" disappears,
   "Scope to batch…" appears as a collapsible.
5. Click "Scope to batch…" → list of batches in course appears.
6. Click "P5 Batch A …" → scope flips back to grey batch pill.
```
**Report:** "A5 ok".

### A6. CSV download

```
1. With no filters, click "Export CSV".
2. Browser downloads `content-2026-05-18.csv`.
3. Open in Excel or text editor.
4. Verify header row reads:
   id,kind,title,course,batch,subject,chapter,topic,uploader,
   is_published,yt_video_id,file_path,created_at
5. Verify a seeded row appears with sensible values.
```
**Report:** "A6 ok — CSV header + rows look right".

### A7. Delete confirmation modal

```
1. Find any disposable row (the seeded "Pending review" is safe after A4).
2. Click "Delete".
3. Black-overlay modal pops up:
      Title:   "Delete content?"
      Body:    mentions row title and "Storage objects remain (orphaned)."
      Buttons: Cancel (grey-border) and Delete (red).
4. Click Cancel → modal closes, no change.
5. Click Delete → Delete in modal → row vanishes from the table.
```
**Report:** "A7 ok".

---

## B. Teacher mobile — UI rendering (real device)

Sign in as **TEACHER** from §0.1.

### B1. Sign in lands on home

```
1. After §0.3 clean restart, enter Teacher credentials.
2. Tap "Sign in" → lands on Teacher Home.
3. Bottom tab bar shows SIX tabs: Home, Scan, Classes, Library, Batch, Profile.
```
**Report:** "B1 ok".

### B2. Library tab — teacher view

```
1. Tap "Library" tab.
2. Header: "Upload Content"
   Subtitle: "Add a YouTube video link or a PDF for your students."
3. Below: three pill row for KIND  →  Video (selected, blue) | PDF | Note.
4. Below KIND: picker rows in white cards with chevrons.
   (No Course row if you only teach one course — seed creates only one.)
   Subject (disabled if blank) | Chapter | Topic
```
**Report:** "B2 ok".

### B3. Cascading picker sheets

```
1. Tap Subject row → bottom sheet "Pick subject" slides up.
   List shows "Physics". Tap it. Sheet closes; row value updates.
2. Tap Chapter → sheet → "Mechanics". Tap.
3. Tap Topic → sheet → "Kinematics" + "Newton's Laws". Tap "Kinematics".
4. After Topic, scroll down. Scope section appears with two pills:
   "My Batch" (selected) | "Suggest course-wide"
5. Below: Batch picker row → tap → sheet "Pick batch" → "P5 Batch A …".
6. Toggle Scope to "Suggest course-wide" → batch row disappears, replaced
   by caption "Admin reviews course-wide suggestions before students see them."
7. Toggle back to "My Batch" → batch row reappears, previous value retained.
```
**Report:** "B3 ok".

### B4. Title + description inputs

```
1. Type "Manual upload test" into Title.
2. Type a 2-line description into the multiline box.
3. No crashes; soft-keyboard hides on blur.
```
**Report:** "B4 ok".

### B5. Video upload — happy path with REAL public YT

```
1. Kind=Video. Scope=My Batch. Batch=P5 Batch A. Topic=Kinematics.
   Title="Manual upload — Rick Astley".
2. Paste `https://www.youtube.com/watch?v=dQw4w9WgXcQ` into the URL field.
3. Tap "Upload".
4. Spinner ~1-2 seconds, then Alert pops:
      "Added"
      "Linked. (YT verification is currently disabled — admin will review.)"
   (Expected — YT_DATA_API_KEY Vault key is not set in dev; server skips
    channel-id validation. Phase 9 ops will plug this.)
5. Tap OK → form clears.
6. Open the admin /content page → the new row appears.
```
**Report:** "B5 ok — alert text shown".

### B6. PDF file picker opens

```
1. Switch Kind to PDF. Title="Manual upload PDF".
2. Tap the dashed "Pick a PDF (max 50 MB)" box.
3. Native document picker opens.
4. Pick any small PDF on your phone.
5. Box updates: shows filename + size in MB.
```
**Report:** "B6 ok — picker opens, filename shown".

### B7. PDF upload — progress bar visible

```
1. After picking, tap Upload.
2. Spinner appears, then progress bar grows 0%→100% under the form with
   caption "Uploading N%…".
3. At 100%, bar vanishes (finalize call runs).
4. Alert "Uploaded" / "Content added to library."
5. Form clears.
```
**Report:** "B7 ok — progress bar visible end-to-end".

### B8. (Optional) Suggest course-wide — admin re-check

```
1. Pick another small PDF. Title="Course-wide suggestion test".
2. Switch Scope to "Suggest course-wide". Tap Upload.
3. Success alert.
4. Open admin /content → the new row shows Status = amber "Pending".
5. (You can publish it via §A4 if you want.)
```
**Report:** "B8 ok — row pending in admin".

### B9. (Optional) Oversize PDF reject — needs >50 MB file

```
1. Pick a PDF larger than 50 MB.
2. As soon as you pick (BEFORE upload), Alert pops "File too large" /
   "Max 50 MB per file."
```
**Report:** "B9 ok" or "B9 skipped".

---

## C. Student mobile — library navigation UI (real device)

Sign out → sign in as **STUDENT 1** (Batch A).

### C1. Library tab — subjects grid

```
1. Tap "Library" tab. Header: "Library".
2. Below header: search input "Search library…".
3. Below: 2-column grid of subject tiles. ONE tile for "Physics"
   with subtitle "N items" (N = 3 + whatever you uploaded in §B5/B7).
4. Each tile has a blue book icon in a rounded square.
```
**Report:** "C1 ok".

### C2. Drill → chapter → topic → items

```
1. Tap "Physics" → header "Physics" with back arrow on the left.
2. Search bar disappears (only shown on subjects view).
3. Chapter list shows "Mechanics" + item count.
4. Tap "Mechanics" → header "Mechanics".
5. Topic list shows "Kinematics" (clickable) and "Newton's Laws"
   (visibly dimmed/disabled because Student 1 sees no Batch-B content).
   Tap Newton's Laws → nothing happens (disabled row).
6. Tap "Kinematics" → header "Kinematics".
7. Item list shows EXACTLY:
      ▶ Intro to Projectile Motion (Batch A only)   VIDEO  Red icon
      📄 Kinematics Formula Sheet                   PDF · course-wide   Green icon
      📝 Lecture notes — Batch A                    NOTE   Amber icon
   (+ anything you uploaded via §B that targets Kinematics.)
8. The "Pending review …" item must NOT appear.
9. The "Newton's Laws (Batch B only)" video must NOT appear.
```
**Report:** "C2 ok — 3 items visible, no batch-B, no unpublished".

### C3. Back navigation

```
1. Back chevron → Topic list.
2. Back → Chapter list.
3. Back → Subject list (search bar reappears).
4. Tap any other tab and back → state resets to Subjects view.
```
**Report:** "C3 ok".

### C4. Search filters live

```
1. Search "Kinematics" → subject tile count drops to 1.
2. Drill into Physics → Mechanics → Kinematics → only 1 row "Kinematics
   Formula Sheet".
3. Clear search → counts restore.
```
**Report:** "C4 ok".

### C5. Cross-batch visual check (Student 3)

```
1. Profile → Sign out → sign in as STUDENT 3 (Batch B).
2. Library → Physics → Mechanics → Kinematics → ONLY 1 row visible:
      📄 Kinematics Formula Sheet
   (Student 3 only has access to course-wide here.)
3. Back to Chapter list → tap Newton's Laws → 1 row visible:
      ▶ Newton's Laws (Batch B only)   VIDEO
```
**Report:** "C5 ok — Student 3 only sees what's in scope".

---

## D. Student mobile — wrapped YT player + watermark (real device)

Sign back in as **STUDENT 1**. Make sure you ran §0.5 to set a real
yt_video_id.

### D1. Player loads + plays

```
1. Library → Physics → Mechanics → Kinematics → tap "Intro to Projectile
   Motion".
2. Screen pushes to /video/[id] — full-screen layout, NO bottom tab bar.
3. Header: back chevron + title (left-aligned).
4. Below: 16:9 black YouTube iframe.
5. Tap the player → it plays. Audio: "Never gonna give you up…"
```
**Report:** "D1 ok — audio plays".

### D2. Watermark text VISIBLE

```
1. Look at the player. In one corner you see semi-transparent white text:
      P5 • ••1001
   (low alpha, with a dark drop-shadow making it readable on any frame.)
2. Tap the player area where the watermark sits — taps go to the player
   (it pauses/plays), watermark does NOT intercept.
```
**Report:** "D2 ok — watermark visible at <position>".

### D3. Watermark rotation (60s timer)

```
1. Note current watermark position.
2. Wait ~60 seconds without touching the screen.
3. Watermark moves to a different corner (cycles: top-left, top-right,
   bottom-left, bottom-right, center-bottom).
4. Wait another minute — moves again.
```
**Report:** "D3 ok — watermark rotated at ~60s".

### D4. Watermark text differs per student

```
1. Sign out → sign in as STUDENT 2.
2. Open the same video.
3. Watermark text should now read "P5 • ••2002" (Student 2's phone last-4).
```
**Report:** "D4 ok — text matches Student 2's phone".

### D5. Resume from X:XX sheet

```
1. Play the video for ~30 seconds.
2. Tap back → return to library.
3. Re-open the same video.
4. After player loads, a bottom sheet slides up:
      "Resume from 0:30?"  (or wherever you got to)
      "You watched up to here last time."
      Two buttons: [Start over] (grey) | [Resume] (blue)
5. Tap "Resume" → player seeks to that time + plays.
6. Tap back → re-open → sheet again → tap "Start over" → seeks to 0.
```
**Report:** "D5 ok".

### D6. No YouTube branding / no Related videos

```
1. Play the video. Observe:
   - NO "Watch on YouTube" overlay.
   - NO grid of related videos at the end.
   - NO YouTube logo bottom-right (modestbranding ON).
   - (Some embed versions still show a tiny "YouTube" tag — acceptable;
      iframe params are the best we can do.)
```
**Report:** "D6 ok" or describe what extra YT chrome shows.

### D7. Pause on screen blur

```
1. Play the video. Audio playing.
2. Tap back arrow → return to library tree.
3. Audio MUST stop immediately (player pauses on screen blur).
```
**Report:** "D7 ok".

---

## E. Student mobile — PDF reader + watermark (real device)

### E1. PDF renders in WebView

```
1. As Student 1 → Library → Physics → Mechanics → Kinematics →
   tap "Kinematics Formula Sheet".
2. Screen pushes to /pdf/[id] — full-screen layout, NO bottom tab bar.
3. Header: back chevron + title + "Page 1 of 1" caption.
4. Below: dark background; pdf.js renders the (seed-tiny) PDF as a
   small white sheet.
5. Brief "Loading PDF…" message during initial render.
```
**Report:** "E1 ok".

### E2. Watermark grid

```
1. Over the PDF, you see a 3×4 grid of rotated text "P5 • ••1001",
   diagonal -30°, low opacity, dark shadow.
2. Watermark does NOT block scroll — try scrolling, the PDF moves but
   watermark stays anchored.
```
**Report:** "E2 ok — grid visible".

### E3. Watermark text differs per student

```
1. Sign out → sign in as STUDENT 3 (Batch B).
2. Library → Physics → Mechanics → Kinematics → tap the formula sheet.
3. Watermark text should now read "P5 • ••3003".
```
**Report:** "E3 ok".

### E4. Pinch zoom + scroll

```
1. Pinch-zoom into the PDF page. The page scales up (max ~4×).
2. Scroll/drag inside the zoomed page.
3. Watermark stays in the viewport (doesn't zoom with the page — that's
   intentional, viewport-level overlay per D-062).
```
**Report:** "E4 ok".

### E5. Page memory (needs multi-page PDF)

The seed PDF is 1 page. To test page memory, upload a multi-page PDF
via §B7 first.

```
1. After uploading a multi-page PDF, open it as a student.
2. Scroll to page 5+. Header updates: "Page 5 of N".
3. Tap back → return to library.
4. Re-open the same PDF.
5. After load, reader auto-scrolls to page 5.
```
**Report:** "E5 ok" or "E5 skipped — no multi-page PDF".

### E6. Screenshot block (Android only)

```
1. On an ANDROID device, open any PDF.
2. Try the screenshot gesture (Power + Volume Down).
3. Expected Android toast: "Can't take screenshot. App restrictions in
   effect." (expo-screen-capture blocks at OS level.)
4. On iOS this is silently no-op — Apple doesn't permit apps to block
   screenshots. Skip on iOS.
```
**Report:** "E6 ok on Android" or "E6 — iOS, no-op as expected".

---

## G. Performance + cross-platform spot-checks

### G1. Cold start budget (Redmi 8A class)

```
1. Force-quit Expo Go.
2. Tap the Expo Go home-screen icon. Time from icon-tap to seeing the
   FyneStudy login screen (NOT the Expo Go logo).
3. Budget: < 3 seconds on Redmi 8A-class.
   (Modern phone: well under 1 second.)
```
**Report:** "G1: cold start was Ns on <device>".

### G2. iOS parity (if you have an iPhone)

```
1. On an iPhone, repeat §D1 + §D3 (video plays + watermark rotates).
2. Repeat §E1 + §E2 (PDF renders + watermark grid).
```
**Report:** "G2 ok — iOS matches Android" or "skipped, no iPhone".

### G3. Long-session memory check

```
1. As Student 1, open the video, let it play for 3+ minutes.
2. Tap back. Open the PDF. Wait 1 min.
3. Repeat 3× total.
4. No crash, no UI lag, no "out of memory" alert.
   (The "one WebView at a time" rule is satisfied because video and PDF
    live on different routes; the previous WebView unmounts on back nav.)
```
**Report:** "G3 ok".

### G4. Airplane-mode recovery

```
1. While in a video, enable airplane mode.
2. Tap back, tap a different video.
3. Expected error UI ("Could not authorize playback." or similar) —
   NOT a white-screen freeze.
4. Disable airplane mode, tap back, retry → works.
```
**Report:** "G4 ok".

---

## H. What I (the agent) already verified — DON'T re-test

Everything below was exercised by automated tests with passing assertions.
The corresponding manual steps were removed from this doc.

- **DB layer:** All 5 migrations applied. Tables, columns, FKs,
  constraints, indexes, triggers, RLS policies, storage buckets,
  storage `objects` deny-all policy, get_vault_secret RPC grants,
  trigger fn search_path — all queried via `information_schema` /
  `pg_policies` / `pg_indexes` / `pg_proc`.
- **All 9 edge fns:** deployed, ACTIVE, verify_jwt=true. Verified via
  `list_edge_functions`.
- **Auth gates:** every fn rejects anon (401), wrong role (403), invalid
  body (400).
- **content-presign-upload:** size + mime + topic-chain validation.
- **content-finalize:** file-existence verify; 404 if missing; happy path
  inserts content_items + audit row.
- **content-create-video:** YT URL parser (10 cases), ISO duration parser
  (6 cases), dev-mode fallback when API key absent, 409 on duplicate
  yt_video_id, 400 on garbage URL.
- **yt-playback-sign:** signed envelope; **watermark text equals
  formatWatermark(full_name, phone)** byte-for-byte; 400 on PDF content.
- **yt-thumb-sign:** returns YT-CDN URL containing the video id.
- **content-pdf-sign:** RLS-scoped access; signed URL serves actual PDF
  bytes; 400 on video content.
- **content-toggle-publish:** both directions; `audit_log` rows for
  `content_publish` AND `content_unpublish` with correct before/after
  is_published values.
- **content-promote-coursewide:** both directions; `audit_log` rows for
  `content_promote` AND `content_unpromote` with correct before/after
  batch_id values.
- **content-delete:** before-data snapshot in `audit_log` with
  action='content_delete'.
- **RLS:** Batch A student sees A+coursewide+published only (NOT batch-B,
  NOT unpublished); Batch B student sees B+coursewide only; Teacher in
  batch A sees A+coursewide (NOT batch-B); anon sees 0; student writes
  to content_items blocked; student writes own video_progress; spoof for
  another student blocked.
- **Pure helpers:** YT URL parser 10/10; ISO duration 6/6; watermark
  formatter 4/4; playback HMAC roundtrip 5/5.
- **TypeScript:** every workspace typechecks. ESLint clean.
- **Mobile jest:** 53/53 incl. the new `lib/watermark.test.ts`.
- **Security advisor:** only the long-standing Phase-1
  `auth_leaked_password_protection` warning remains (unrelated to Phase 5).

---

## I. Report-back format

Quick list per section:

```
A1 ok
A2 ok — pills correct
A3 ok
A4 ok
A5 ok
A6 ok — CSV header matches
A7 ok

B1 ok
B2 ok
B3 ok
B4 ok
B5 ok — alert message: "Linked. (YT verification …)"
B6 ok
B7 ok
B8 ok (or skipped)
B9 skipped (or ok)

C1 ok
C2 ok — 3 items
C3 ok
C4 ok
C5 ok — S3 sees correct subset

D1 ok
D2 ok — watermark visible top-right
D3 ok — rotated at ~60s
D4 ok — text changed to ••2002
D5 ok
D6 ok (or: small YouTube logo still shows)
D7 ok

E1 ok
E2 ok
E3 ok
E4 ok
E5 ok (or skipped)
E6 ok on Android (or: iOS, no-op)

G1: cold start 2.4 s on Pixel 6
G2: iOS works
G3: no crash after 3 cycles
G4: error UI shown, recovered
```

Anything that **fails** — paste the step + screenshot if visual. I'll
diagnose and patch before we move to Phase 6.
