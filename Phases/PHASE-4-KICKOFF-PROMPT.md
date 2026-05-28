# PHASE 4 KICKOFF PROMPT

> Copy the **entire block below** (from `I'm continuing the FyneStudy…` through `Begin.`) as the very first message in a brand-new Claude Code conversation in this same repo. Phase 4 is the **largest** phase — it builds the live class flow + the entire teacher portal + the webcam scanner — so plan multiple work sessions.

---

I'm continuing the FyneStudy Web App Conversion. We're executing **Phase 4 — Live Classes + Teacher Portal** today. This is a NEW conversation. Read carefully, ask before guessing, and don't deviate from the locked rules below. After Phase 4 the web app is at **full feature parity** with the mobile app — Phase 5 is hardening + QA + launch only.

---
🚦 Phase 3 status (signed off / acceptable state as of 2026-05-28) — TRUST THIS, DO NOT MODIFY

Phase 3 is CODE-COMPLETE and committed on `web-phase-1` (one long-lived web track branch, NOT pushed). The latest two commits on that branch should be:

- `c76e551 fix(web-phase-3): tab-switch Alt-Tab dedup + D-181 flicker guard + manual-test doc to Phase-1 depth`
- `f3102ef feat(web-phase-3): assessments — quizzes + exams`

Every automated gate is green:

- `pnpm --filter @fynestudy/web typecheck` → 0 errors.
- `pnpm --filter @fynestudy/web lint` → 0 errors, 0 warnings.
- `pnpm --filter @fynestudy/web test` → 92/92 unit tests pass (15 files).
- `pnpm --filter @fynestudy/web build` → 27 routes including `/quiz/[id]` and `/exam/[id]`, sw.js generated, no `Attempted import error` warnings, no SUPABASE_SERVICE_ROLE in `.next/static`.
- Playwright Phase 3 specs (`quiz-attempt`, `exam-attempt`, `security-attempt`) green; security spec asserts no `is_correct` / `correct_option_id` / `service_role` in any client-bound response.

Manual QA on Chrome desktop is in flight by the user against `Phases/phase-3-manual-tests.md` (~1248 lines, ~120 min). iOS Safari + Android Chrome PWA install rows are carry-over (need HTTPS / Vercel deploy).

Do NOT touch any of these Phase 1 / Phase 2 / Phase 3 files unless you find an actual bug (and if you do, STOP and ask the user before editing):

**Phase 1 foundation** (untouchable):
- `apps/web/middleware.ts`
- `apps/web/lib/{env,auth,edge-fn,utils,query,ist,watermark}.ts`
- `apps/web/lib/supabase/{server,browser,middleware}.ts`
- `apps/web/features/auth/{SessionProvider,role-helpers,schemas}.{ts,tsx}` (extend with new hooks, don't rewrite)
- `apps/web/app/{login,forgot-password,reset,force-password-change,suspended,admin-redirect,role-chooser,privacy,terms,error,not-found,loading,_styleguide,sw,manifest}/...`
- `apps/web/app/actions/{set-active-role,sign-out}.ts`
- `apps/web/app/(protected)/layout.tsx` (the shell)
- `apps/web/components/fyne/*` (15 primitives)
- `apps/web/components/ui/*` (shadcn primitives)
- `apps/web/components.json`, `eslint.config.mjs`, `next.config.ts`, `postcss.config.mjs`, `tsconfig.json`, `vitest.config.ts`, `playwright.config.ts`
- `apps/web/types/modules.d.ts`

**Phase 2 student learning surfaces** (untouchable):
- `apps/web/app/(protected)/page.tsx` + `_components/StudentDashboard.tsx`
- `apps/web/app/(protected)/{profile,leaderboard,attendance,classes,library,menu}/page.tsx` + `_components/*.tsx`
- `apps/web/app/video/[contentId]/page.tsx` + `_components/VideoClient.tsx`
- `apps/web/app/pdf/[contentId]/page.tsx` + `_components/PdfClient.tsx`
- `apps/web/features/{dashboard,gamification,leaderboard,attendance,library,profile,org}/...` — EXTEND with new Phase 4 hooks; don't rewrite.
- `apps/web/components/{dashboard,gamification,leaderboard,attendance,player,profile}/*` — EXTEND; don't rewrite.

**Phase 3 assessments** (untouchable):
- `apps/web/app/quiz/[id]/` + `apps/web/app/exam/[id]/`
- `apps/web/components/{math,quiz,exam}/*`
- `apps/web/features/quiz/*` + `apps/web/features/exams/*` (the new Phase-3 hooks/types; Phase 2 also added `useStudentExams` here — that's part of Phase 2 discovery, leave it)
- `apps/web/app/(protected)/classes/_components/StudentClasses.tsx` (Phase 3 wired the exam rows; Phase 4 may extend the Live segment to route to `/live/[sessionId]`)
- `apps/web/app/(protected)/library/_components/LibraryClient.tsx` (Phase 3 wired the per-topic quiz links; don't undo)
- `apps/web/components/dashboard/WeakTopicsList.tsx` (Phase 3 wired `quiz_id` routing)

Phase 3 will get its acceptance-ledger sign-off line replaced (from "code-complete pending manual QA" → "✅ ACCEPTED 2026-05-XX") at the bottom of `Phases/phase-3-assessments-quizzes-exams.md` once the user finishes manual QA. Don't write that line yourself.

---
Step 0 — READ THESE FIRST (in this order)

1. `CLAUDE.md` — every rule. Highlights still apply:
   - Anon key only in `apps/web` (no service-role).
   - Every privileged write through an edge fn.
   - `is_correct` NEVER reaches the client during an attempt — Phase 3 already enforces this and the Phase 3 cacheKeySecurity test trips if you regress.
   - Server is the only source of truth for the exam timer + QR validity.
   - Realtime channels MUST be `removeChannel`-cleaned on unmount.
   - Only ONE YouTube player mounted at a time.
2. `Phases/00-overview-and-architecture.md` — re-read §4 W-DEC table. Specifically W-11 (`@yudiel/react-qr-scanner` for webcam), W-13 (`react-youtube`), W-16 (`<input type=file>` for upload), W-18 (`navigator.clipboard` for RTMP), W-22 (realtime cleanup + Query cache integration).
3. **`Phases/phase-4-live-classes-teacher-portal.md` — THIS IS THE SOURCE OF TRUTH for Phase 4 scope.** Read it in full. Lists every screen, component, hook, edge fn / RPC / realtime channel, gotcha, automated test, manual checklist, and acceptance criterion. It says to split work into two sub-tracks (4A live + 4B teacher); follow that.
4. `Phases/phase-3-assessments-quizzes-exams.md §J` — to confirm Phase 3 invariants you must not regress: D-178 KaTeX lazy mount, D-181 re-open routing, D-182 fire-and-forget tab switch, D-183 server-anchored timer + 60s resync.
5. `Phases/{phase-1,phase-2,phase-3}-manual-tests.md` — to know the EXACT beginner-friendly format you MUST mirror in `Phases/phase-4-manual-tests.md`: numbered 👉 Do this / ✅ What you should see / ❓ If something looks different (≥2 failure modes per test) / `Result:` checkboxes + §N acceptance sign-off + a troubleshooting cheat-sheet at the bottom. Phase 4 is the biggest phase — target ~1800–2200 lines.
6. **Inventory `apps/web/` before adding anything.** Don't duplicate hooks / components / utility functions. Reuse existing `Pill`, `Segmented`, `EmptyState`, `Dialog`, `Sheet`, `Tabs`, `Skeleton`, `AppShell`, `FocusLayout`, `Watermark`, `WrappedYtPlayer`, `useChangePassword`, `formatIstDay/Time`, `invokeEdgeFn/Public`, etc.
7. Mobile sources to port from — open each as you build the matching web screen / hook. The Phase 4 scope doc tells you which mobile file each web route mirrors.
8. `docs/decisions.md` — at minimum quote / honour: D-152 (teacher batch-scope on app_users for embed joins), D-157 / D-169 (top-level routes outside tab group — already implemented for quiz/exam in Phase 3; same pattern for live/recording/builders/roster/live-control/exam-results/offline-scores), D-164 (tap active pill toggles to unmarked), D-171 (PDF signed URL via edge fn), D-172 (admin server-action mutations always through edge fn so `audit_log` captures before/after), D-173 (no `controls=0` on YT iframe), D-179 (full-recompute regrade), D-190..D-196 (Phase 9 live decisions: chat is direct-RLS-insert with SECURITY DEFINER trigger rate-limit, stream key never persisted, etc.), D-197..D-202 (Phase 10 leaderboard — already in Phase 2, reference only).
9. Edge fn + RPC + realtime signatures — read each one referenced in the Phase 4 scope doc (apps/functions/yt-*, chat-*, attendance-*, content-*, quiz-admin-mutate, exam-admin-mutate, exam-release-results, exam-regrade, offline-score-upsert, session-create-ad-hoc) + the `teacher_dashboard` / `teacher_batch_overview` RPCs.

---
🔑 Test accounts (verified live 2026-05-28)

Same accounts as Phase 1/2/3. Phase 4 leans on the TEACHER account heavily for the teacher portal — make sure it's in at least one batch with students.

| Account | Email | Password | Notes |
|---|---|---|---|
| Student | `review.student@fynestudy.app` | `ReviewStudent#2026` | for the live + recording + scan-target tests |
| Teacher | `review.teacher@fynestudy.app` | `ReviewTeacher#2026` | the main account for the teacher portal |
| Owner admin | `owner@fynestudy.example.com` | `FyneOwner#2026` | admin panel: release results / verify audit |
| Extra student (Aarav) | `test.aarav@fynestudy.app` | `TestPass#2026` | for scanning + roster + leaderboard |
| Extra student (Diya) | `test.diya@fynestudy.app` | `TestPass#2026` | for scanning + roster |

**Seed:** before testing, refresh fixtures with `pnpm seed:live-manual-test --reset` (creates LIVE + UPCOMING + ENDED sessions on a real public YouTube video, on the teacher's batch). Reuse `pnpm seed:quiz-manual-test --reset` + `pnpm seed:exam-manual-test --reset` from Phase 3 for the builders.

**Supabase project:** `orqwyazvcthgxoadfxfv` (ap-south-1). The web client reads anon key from `apps/web/.env.local` — DO NOT add `SUPABASE_SERVICE_ROLE_KEY` to that file ever.

**YouTube is already provisioned** (2026-05-26): 5 Vault secrets + permanent refresh token on the dev's TEMP channel "NOvA FX" (`UCSa8awrJseI_8r_oZQjuvYQ`, live-enabled). `yt-*` edge fns return real keys. For a §G OBS dry-run you'd need OBS pointed at the RTMP target — the user will run this with you.

**HTTPS:** webcam (`getUserMedia`) works on `localhost` + Vercel (HTTPS) but NOT on LAN IPs. Dev your scanner locally; iOS Safari / Android Chrome carry-over after Vercel deploy.

---
🛠 What Phase 4 BUILDS

Read `Phases/phase-4-live-classes-teacher-portal.md` for the authoritative scope. Summary:

**Track 4A — Live classes + recordings (student-facing, 8 build steps in the scope doc)**

- `app/live/[sessionId]/` (FocusLayout, OUTSIDE `(protected)`): `useLiveSession` polls every 10s while `scheduled`. Stages: **lobby** (LobbyCountdown — dark screen + countdown + waiting spinner) → **live** (WrappedYtPlayer via `react-youtube` + Watermark + ChatPane + ChatComposer + RaiseHandButton + PinnedBanner).
- Chat: realtime `chat-{sessionId}` (INSERT/UPDATE). Direct RLS insert (NO edge fn). SECURITY DEFINER server trigger denormalizes author + enforces 5-msgs/30s rate-limit. Show disabled-reason when banned / not-live.
- Raise hand: realtime `hands-{sessionId}`. Banned students CAN'T raise (Phase-9 RLS fix).
- Pinned announcement + end-of-class: chat_messages rows with `kind` — render specially.
- Own ban: realtime `ban-{sessionId}-{userId}`; if banned, disable composer + raise-hand live.
- Reconnect-reload: on realtime reconnect, reload chat history (Phase-9 fix).
- `app/recording/[sessionId]/` (FocusLayout): `usePlaybackSign(kind:'recording')` → player with `playbackRate` (1x / 1.5x / 2x); `ChatReplay` reveals messages by current player time.
- Cleanup: `removeChannel` for EVERY channel on unmount.

**Track 4B — Teacher portal (11 build steps)**

- **`(teacher)/` home** — `useTeacherDashboard` (RPC) → next-class card + attendance CTA, `PendingList` (exams to release + raised-hand count), today's classes, quick actions, batch cards. Desktop = multi-column.
- **`(teacher)/scan` (webcam QR)** — `navigator.mediaDevices.getUserMedia` + `@yudiel/react-qr-scanner` (lazy-loaded). `ScannerOverlay` (corner brackets). Session dropdown. 500ms debounce. Handle 400/401/403/404/409/429 with same toasts as mobile. Permission-denied fallback → "Open roster" link.
- **`(teacher)/classes`** — Today/Upcoming/Past segments; Schedule-Live + Ad-hoc sheets; per-row actions (Scan/Roster/Live Control).
- **`(teacher)/content` upload** — Course → Subject → Chapter → Topic picker + scope + title + file/URL. Video URL → `content-create-video`. PDF → `<input type=file>` → `content-presign-upload` → PUT to signed URL → `content-finalize` (progress bar from the fetch upload).
- **`(teacher)/quizzes` + `quiz-builder/[quizId]`** (FocusLayout) — list → builder: title/duration/topics, question list, add-from-bank, inline editor, option images via `quiz-image-presign` → PUT, publish toggle. ALL writes through `quiz-admin-mutate` (D-172). "new" vs uuid mode.
- **`(teacher)/exams` + `exam-builder/[examId]`** (FocusLayout) — list → builder: title, batch, start time, duration, release type, questions; edit-after-publish warning; atomic question-replace (Phase-7 fix). Writes via `exam-admin-mutate`.
- **`exam-results/[examId]`** (FocusLayout) — attempts table with scores + question-level correct%; Release (`exam-release-results`) + Regrade (`exam-regrade`: change-correct / mark-all-correct, full-recompute per D-179) in a Dialog.
- **`offline-scores`** (FocusLayout) — batch picker + test name/date/subject/max + roster score inputs → Save all via `offline-score-upsert`.
- **`(teacher)/batch` + `batch/[id]`** — list of assigned batches → analytics tabs Risk / Mastery / Attendance (`useTeacherBatchOverview` RPC): AtRiskList, TopicMasteryBars, BatchHeatmap.
- **`roster/[sessionId]`** (FocusLayout) — realtime `teacher-roster-{id}` → RosterRow per student with P/L/A pills + correction Dialog → `attendance-correct` / `attendance-manual-mark` / `attendance-unmark` / `attendance-bulk-mark`. Tap active pill toggles to unmarked (D-164).
- **`live-control/[sessionId]`** (FocusLayout) — Setup: Create broadcast (`yt-broadcast-create`) → show RTMP server + stream key with Copy buttons (`navigator.clipboard`). Go Live (`yt-broadcast-golive`). Live: viewer preview + moderation (delete msg, ban user via `chat-delete`/`chat-ban`); raise-hand queue (teacher mode); pin composer; End class (`yt-broadcast-stop`). Stream key NEVER persisted (idempotent re-fetch via `boundStreamId`).

**Deps to add (W-DEC):** `@yudiel/react-qr-scanner` (webcam QR — lazy-loaded). Possibly `zxing-wasm` peer if needed for iOS Safari fallback. Check the package's docs.

---
❌ What Phase 4 does NOT build

- Sentry + PostHog wiring (deferred to Phase 5).
- Vercel deploy + CORS extension + Supabase Auth redirect-URL allowlist for `web-*.vercel.app` (Phase 5 hardening).
- iOS Safari + Android Chrome on-device PWA install verification (needs HTTPS — Phase 5).
- Multi-role + suspended account creation (carry-over from Phase 1).
- Any change to edge functions, RPCs, RLS, or Supabase schema. **Phase 4 is FRONT-END ONLY.** If you think a backend change is needed, STOP and ask the user.
- Real OBS streaming dry-run — the user will do this themselves in §G of the manual tests using their own OBS install.

---
🔒 Locked decisions + hard rules

| Topic | Rule |
|---|---|
| Anon key only in `apps/web` | Service-role key NEVER appears. Re-grep `.next/static` after build (same as Phase 1/2/3). |
| `is_correct` MUST NOT leak (Phase 3 invariant — DON'T REGRESS) | The cacheKeySecurity test will fail if you mention `is_correct` in any attempt-stage source. Phase 4 doesn't touch quiz/exam attempt UIs but does touch the EXAM RESULTS BOARD — that one IS post-submit and may reveal correctness, but be deliberate: use the same edge fns (`exam-attempt-result`) and only render the data the server sends. |
| Server is the timer / QR / scan authority | Webcam decodes the QR but `attendance-qr-verify` is the gate. Late/expired QRs return 410 or 409 — show the right toast. |
| Webcam needs HTTPS + a user gesture | Start the camera on a button press, not on mount. `localhost` is treated as secure by browsers; LAN IPs are NOT. iOS Safari: `playsinline` + `getUserMedia({ video: { facingMode: 'environment' } })`. |
| Realtime cleanup is MANDATORY | Every `supabase.channel(...)` MUST have a matching `removeChannel(...)` in cleanup. The Phase 2 grep audit (`Select-String ... supabase\.channel\(` count == `removeChannel(` count) must still pass after Phase 4. |
| Only ONE YouTube player at a time | Live preview in live-control + the student live player are different sessions/screens — fine. But don't mount two in one view. Unmount the player when switching stages. |
| Chat is a DIRECT RLS insert | NOT an edge fn. The SECURITY DEFINER server trigger denormalizes author name/role + enforces the 5-msgs/30s rate-limit. Don't write `author_name` from the client. |
| Stream key NEVER persisted | `live-control` calls `yt-broadcast-create` → returns rtmp/key; show + Copy buttons; if user navigates away and comes back, re-fetch via the bound `streamId` (idempotent). Don't put it in React Query cache with `staleTime: Infinity`. |
| `controls=0` is FORBIDDEN on the YT iframe | Mobile decision D-173 — keep native YouTube controls. |
| `attendance-qr-verify` 500ms debounce | Multiple rapid QR frames within 500ms send only ONE verify; suppress duplicates by token. |
| Teacher batch-scope (D-152) | Reading student names via `students(app_users!user_id(full_name))` requires the teacher's RLS batch-scope. Already in the backend; use the same select shapes as the mobile teacher hooks. |
| D-172 audit | EVERY teacher-side mutation in builders / results / offline-scores / roster goes through an edge fn (`quiz-admin-mutate`, `exam-admin-mutate`, etc.). No direct RLS write for those resources. |
| FocusLayout for top-level teacher routes | `quiz-builder/[quizId]`, `exam-builder/[examId]`, `exam-results/[examId]`, `offline-scores`, `roster/[sessionId]`, `live-control/[sessionId]`, `live/[sessionId]`, `recording/[sessionId]` all live OUTSIDE `(protected)/layout.tsx` (mirrors mobile D-157/D-169). Auth still goes through middleware. |
| Git branch | Continue on `web-phase-1`. Commit at the end of each track with `feat(web-phase-4): live + recordings` (4A) and `feat(web-phase-4): teacher portal` (4B). Do NOT push or merge to main. |

---
🚫 Anti-patterns — common Phase 4 ways to break correctness

1. **Mounting `react-youtube` twice in one view** → memory leak + viewer-count weirdness. One player at a time.
2. **Forgetting `removeChannel` on unmount** → ghost realtime subscriptions accumulate; the next student to enter the session sees duplicated chat events. Always pair create+remove.
3. **Polling `useLiveSession` while live** → wasteful. Poll only while `scheduled`. Once `status='live'`, rely on the realtime channel + a single `usePlaybackSign` call. (Re-poll on visibility change as a safety net.)
4. **Trying to write `author_name`/`author_role` from the client when inserting a chat message** → the SECURITY DEFINER trigger overrides anyway; don't bother. INSERT only `{ session_id, body, kind }`.
5. **Caching the stream key** → if it leaks via a Sentry breadcrumb or a query inspector, the live broadcast is compromised. Use `useState` (component-local), NOT React Query.
6. **Auto-starting the webcam on mount** → on iOS Safari this fails silently. Require a button press. Show a "Start camera" CTA + explain why permission is needed.
7. **Showing camera-permission error as a dead-end** → always offer the manual-mark roster fallback ("Open roster" link routes to `/roster/[sessionId]`).
8. **Calling `attendance-qr-verify` on every decoded frame** → the camera decodes ~10 frames/sec. Debounce 500ms + suppress same-token duplicates.
9. **Sending `correct_option_id` in a builder save payload** → builders manage the question bank, so they DO touch `is_correct` server-side, but only via `quiz-admin-mutate` / `exam-admin-mutate` edge fns. The web admin client legitimately sees correctness for the QUESTION BANK (it's the question author surface) — but never via the student attempt path.
10. **Mixing realtime channel names** → `chat-{sessionId}`, `hands-{sessionId}`, `bans-{sessionId}`, `ban-{sessionId}-{userId}`, `teacher-roster-{sessionId}`. Each has a separate cleanup. Use a `Map<channelName, RealtimeChannel>` if you find yourself subscribing dynamically.
11. **Showing the YT controls=0 mode** → forbidden per D-173. Always allow native YouTube controls.
12. **Routing `/scan` to a `(teacher)` group path** that the middleware doesn't recognise → middleware.ts already has the teacher-only list; `/scan` is in it. Don't break the gate.
13. **Reusing the Phase 3 cache keys** for live-attendance or chat — different feature, different keys. Realtime is integrated with TanStack via `queryClient.invalidateQueries` / `setQueryData` per channel event (W-22).
14. **Editing the existing Phase-2 `useStudentExams.ts`** → it's a discovery hook. Phase 4 doesn't need to touch it. The teacher exam list is a NEW hook (`useTeacherExams`).
15. **Skipping the chat reconnect-reload** → on realtime disconnect → reconnect, fetch the chat history once so no messages are missed. This is the Phase-9 carry-over fix; reproduce it on web.

---
✅ Verification — every box must tick before manual test doc

Run from the repo root after each track:

```powershell
pnpm --filter @fynestudy/web typecheck   # 0 errors
pnpm --filter @fynestudy/web lint        # 0 errors, 0 warnings
pnpm --filter @fynestudy/web test        # all unit tests green (Phase 4 adds ~10 new)
pnpm --filter @fynestudy/web build       # 35+ routes, no Attempted import error
```

Unit tests to write (Vitest, under `apps/web/<area>/__tests__/`):
- `chatReplaySync.test.ts` — offset sync: given a list of messages with timestamps + a player current time, returns the messages to show now (boundary math, ordering).
- `scanToastMapper.test.ts` — status→toast: 200/400/401/403/404/409/410/429 → correct toast text.
- `rosterCorrectionState.test.ts` — pill state transitions on tap (D-164: tap active pill toggles to unmarked).
- `builderQuestionReplace.test.ts` — Phase-7 atomic replace logic.
- `offlineScoreValidation.test.ts` — zod schema for the score input form.
- `raiseHandQueue.test.ts` — FIFO ordering; resolving + banning pop the user out.
- `cameraGesture.test.ts` — assert `getUserMedia` is NOT called until the start button is pressed.
- `realtimeCleanupAudit.test.ts` — source-scan: count `supabase.channel(` calls + count `removeChannel(` calls in each `features/{live,teacher}/` file — counts must match.

E2E (Playwright, extend `e2e/`):
- `live-student.spec.ts` — student joins a live session, sees the player, posts a chat (rate-limit kicks in at the 6th msg/30s), raises hand. Mock the YouTube embed if the real video isn't reachable.
- `recording.spec.ts` — open a recording, chat replay reveals in sync, playbackRate change.
- `teacher-scan.spec.ts` — mock `getUserMedia` to return a known QR frame → assert `attendance-qr-verify` was called; denied permission → fallback link visible.
- `teacher-builders.spec.ts` — quiz builder + exam builder happy path with mocked file presign.
- `teacher-results.spec.ts` — release results + regrade (mock the edge fn responses).
- `live-control.spec.ts` — create broadcast (mock the YT API), Copy buttons set clipboard, go-live flips status, end class.

Manual gates (script + grep):
- Realtime cleanup audit: `Select-String -Path "apps/web/features/**/*.ts" -Pattern "supabase\.channel\("` count MUST equal `removeChannel(` count.
- No-service-role-key grep on `.next/static`.
- No `is_correct` regression in any attempt-stage source (the Phase 3 cacheKeySecurity test still passes).

Seed before manual + E2E:
```powershell
pnpm seed:live-manual-test --reset
pnpm seed:quiz-manual-test --reset
pnpm seed:exam-manual-test --reset
```

---
📋 Manual test doc requirement

Write `Phases/phase-4-manual-tests.md` in the same beginner-friendly format as Phase 1 + Phase 2 + Phase 3 manual test docs. Treat them as the template you MUST clone, section-for-section. Specifically:

1. Header note explaining audience (zero coding background) + how to record results + estimated time (~3 hours including the OBS dry-run).
2. 🔑 Test accounts table at the top.
3. Table of contents linking the sections below.
4. §0 Setup with copy-paste PowerShell commands and exact terminal-output samples.
5. Per-test format (mandatory for every numbered test):
   - `### Test ID — short name`
   - **👉 Do this:** numbered substeps (URLs, button labels, fields verbatim).
   - **✅ What you should see:** bullets with specific UI text + visuals.
   - **❓ If something looks different:** troubleshooting for at least 2 common failure modes per test.
   - `Result:` [ ] PASS · [ ] FAIL · [ ] N/A checkboxes + a blank line for the user's notes.
6. Sections (mandatory):
   - §0 Setup — refresh deps (Phase 4 adds `@yudiel/react-qr-scanner`), env, dev server, seed scripts, HTTPS note.
   - §A Student live class — lobby → live → chat → raise-hand → pinned → end-of-class.
   - §B Student recording — playback rate, chat replay sync.
   - §C Teacher home dashboard — RPC card layout, PendingList.
   - §D Teacher scan (webcam QR) — start camera, decode a QR, success/fail toasts, permission-denied fallback.
   - §E Teacher classes — Today/Upcoming/Past + Schedule-Live + Ad-hoc.
   - §F Teacher content upload — Video URL + PDF presign+PUT+finalize.
   - §G Teacher live control + REAL OBS DRY-RUN — create broadcast, copy RTMP into OBS, go live, student joins, moderate, end class.
   - §H Teacher quiz builder — list + builder + publish toggle + image presign.
   - §I Teacher exam builder + results + regrade — list, builder, release, regrade.
   - §J Teacher offline scores — batch picker + roster save.
   - §K Teacher batch analytics — Risk/Mastery/Attendance tabs.
   - §L Roster — pill marks + correction + tap-active-toggles-to-unmarked + realtime sync.
   - §M Security + cleanup — realtime channel cleanup grep, no service-role-key, chat rate-limit enforced, banned user can't post/raise.
   - §N Responsive + carry-overs — desktop ↔ mobile-web at 320 → 1440 px (iOS Safari + Android Chrome CARRY-OVER).
   - §O Automated test gates — typecheck / lint / vitest / build / Playwright.
   - §P Acceptance sign-off.
7. Troubleshooting cheat-sheet table at the bottom (12–15 rows of common Phase-4 symptoms).
8. Carry-overs section listing what's deferred.

Length target: ~1800–2200 lines (Phase 4 is the biggest phase by surface area).

🛑 Wait for the user to sign off the manual tests before declaring Phase 4 accepted.

---
📝 Acceptance — when Phase 4 is DONE

1. Every checkbox in `Phases/phase-4-live-classes-teacher-portal.md`'s "Acceptance criteria" section is ticked (or marked carry-over with a reason).
2. Append the §J acceptance ledger to the BOTTOM of `Phases/phase-4-live-classes-teacher-portal.md` (mirror the structure of Phase 3 §J: code shipped / tests / W-DEC entries / carry-overs / honored decisions / status).
3. Update `CLAUDE.md`'s "🌐 Web App Conversion track" — add `Phase 4 ✅ code-complete <date>` with a one-sentence summary; bump the header to "(in progress — Phase 4 code-complete YYYY-MM-DD)".
4. Save a memory file at `C:\Users\kaust\.claude\projects\C--Users-kaust-OneDrive-Desktop-FyneStudyLive\memory\project_web-phase-4-status.md` summarising what shipped + W-DECs + carry-overs. Add the one-line pointer to `MEMORY.md`. Update the "Web conversion plan" pointer line ("Phase 5 next" instead of "Phase 4 next").
5. Commit on `web-phase-1` (same long-lived branch). Track 4A commit: `feat(web-phase-4): live classes + recordings`. Track 4B commit: `feat(web-phase-4): teacher portal`. Do NOT push or merge to main.

---
🛑 Stop condition

When Phase 4 is fully accepted (every acceptance criterion green + manual tests signed off + ledger appended + CLAUDE.md updated + memory file saved + commit landed on `web-phase-1`), STOP. Do NOT start Phase 5. The user will open a new conversation with the Phase 5 prompt.

---
🤝 If anything is ambiguous

ASK THE USER FIRST. Specifically expect ambiguity in:

- Whether to lazy-load the QR scanner with `dynamic({ ssr: false })` or render server-side (the package only works client-side; lazy-load is recommended).
- Whether to mock `getUserMedia` in Playwright for the scan test, or skip it on environments without a camera (mock is recommended; skip on CI if mocking is fragile).
- What the exact UI for the live preview in `live-control/[sessionId]` should be — mobile shows the same wrapped player; on web a small embed is fine but DON'T mount two YT players for the same session (one in live + one in live-control by the same teacher could collide). Confirm the spec.
- How to handle the `yt-broadcast-create` failure mode — show an inline error + a Retry button; don't lose the user's "Create broadcast" intent.
- Whether to surface the `tab_switch_count` to the teacher in the roster or live-control UI — mobile doesn't, leave it out unless asked.
- Whether to ship a "Re-scan" button on the scan screen that re-mounts the camera — should help with iOS Safari refresh issues; ask if it's not in the mobile equivalent.

The project's CLAUDE.md first line says: "Every time you code, don't just guess. Be precise; if you have any doubts then ask me." Honor that.

---
Sanity-check after reading the above: if you find any conflict between this prompt and `Phases/phase-4-live-classes-teacher-portal.md`, the **phase doc wins for scope**; this prompt wins for **process**. Ask if it's still unclear.

Begin.

---

## How to use this prompt

1. Open a brand-new Claude Code conversation in this same repo (open a new tab in the Claude Code IDE/extension, or `Win+R → wt → claude` if you use the CLI).
2. Paste the entire block above (from `I'm continuing the FyneStudy…` through `Begin.`) as the very first message.
3. The new Claude will read every file the prompt references, then start building Phase 4. It won't touch Phase 1/2/3 untouchables, it'll skip the items explicitly deferred (Vercel, multi-role, etc.), and it'll write `Phases/phase-4-manual-tests.md` mirroring Phase 1/2/3's format.
4. Phase 4 is the BIGGEST phase. Expect multiple work sessions. The scope doc + this prompt encourage splitting into Track 4A (live + recordings, ~1 session) then Track 4B (teacher portal, ~2 sessions). Let the new Claude break the work up — that's the right pattern.
5. If you get stuck mid-build, you can paste back: "Re-read `Phases/PHASE-4-KICKOFF-PROMPT.md` — you missed §<section>."
