# PHASE 4 TRACK 4B KICKOFF PROMPT (Teacher Portal)

> Copy the **entire block below** (from `I'm continuing the FyneStudy…` through `Begin.`) as the very first message in a brand-new Claude Code conversation in this same repo. Track 4A (student live + recordings) is already shipped — this prompt completes Phase 4 by adding the teacher portal.

---

I'm continuing the FyneStudy Web App Conversion. We're executing **Phase 4 Track 4B — Teacher Portal** today. This is a NEW conversation. Read carefully, ask before guessing, and don't deviate from the locked rules below. After Track 4B the web app is at **full feature parity** with the mobile app — Phase 5 is hardening + QA + launch only.

---
🚦 Track 4A status (signed off / acceptable state as of 2026-05-28) — TRUST THIS, DO NOT MODIFY

Track 4A is CODE-COMPLETE and committed on `web-phase-1`. The latest commit on that branch should be:

- `281d6fe feat(web-phase-4): live classes + recordings (Track 4A)`

Every automated gate is green:

- `pnpm --filter @fynestudy/web typecheck` → 0 errors.
- `pnpm --filter @fynestudy/web lint` → 0 errors, 0 warnings.
- `pnpm --filter @fynestudy/web test` → 117/117 unit tests pass (17 files).
- `pnpm --filter @fynestudy/web build` → 29 routes including `/live/[sessionId]` and `/recording/[sessionId]`, sw.js generated, 0 `service_role` matches in `.next/static`.
- Playwright Track 4A specs (`live-student`, `recording`) compile + run (seed-tolerant).

Manual QA of Track 4A (`Phases/phase-4-manual-tests.md` §A + §B + §M + §N + §O) is in-flight by the user. Track 4B does NOT need to wait for that QA to finish — work continues on the same branch.

**Track 4A shipped (don't rewrite these unless you find a real bug; if you do, STOP and ask):**

Hooks (5 + 1 utility):
- `apps/web/features/live/{useLiveSession,useLivePlaybackSign,useRaiseHand,useSessionState}.ts`
- `apps/web/features/chat/useChatChannel.ts`
- `apps/web/features/live/chat-replay.ts`

Components (6):
- `apps/web/components/live/{LobbyCountdown,ChatPane,ChatComposer,RaiseHandButton,PinnedBanner,ChatReplay}.tsx`

Routes (2 top-level outside `(protected)`):
- `apps/web/app/live/[sessionId]/{page.tsx, _components/LiveClient.tsx}`
- `apps/web/app/recording/[sessionId]/{page.tsx, _components/RecordingClient.tsx}`

Extended:
- `apps/web/components/player/WrappedYtPlayer.tsx` — now forwardRef with imperative `play / pause / seekTo` + optional `playbackRate` / `onPlayingChange` / `onDuration` / `onPosition` props. Phase-2 `VideoClient` still works unchanged. **You may use this player in `/live-control` Stream tab with the new imperative handle.**

Tests:
- `apps/web/features/live/__tests__/{chat-replay,realtimeCleanupAudit}.test.ts`
- `apps/web/e2e/{live-student,recording}.spec.ts`

Wiring:
- `apps/web/app/(protected)/classes/_components/StudentClasses.tsx` (Live + Recorded segments link to `/live/{id}` and `/recording/{id}`). **Track 4B will EXTEND this to add a teacher branch** (Schedule-Live FAB) — see Step 11 below.

**Phase 1/2/3 untouchables also apply** — see `Phases/PHASE-4-KICKOFF-PROMPT.md` for the canonical list. Don't rewrite any of those files unless you find a real bug (STOP and ask).

---
🔒 Locked decisions from the prior session (confirmed via AskUserQuestion 2026-05-28)

1. **QR scanner load mode**: lazy via `next/dynamic({ ssr: false })`. The package only works in the browser; lazy-load keeps it out of the initial `/scan` bundle.
2. **Playwright /scan E2E**: mock `navigator.mediaDevices.getUserMedia` + intercept `attendance-qr-verify` with a Playwright `page.route(...)` mock. Don't rely on a real camera in CI.
3. **Live-control "preview" UI**: **Tabbed view** — a `Stream` tab embeds `WrappedYtPlayer` on the same broadcast; a `Moderate` tab shows chat + raise-hand queue + moderation. Only one is rendered at a time so only one YT iframe mounts per view. Satisfies the "one player per view" rule.
4. **`yt-broadcast-create` failure surface**: inline error card + Retry button + KEEP the teacher's form state (title/description). NOT a toast that resets the form.
5. **`tab_switch_count` exposure on web**: don't surface anywhere on web — match mobile. The count is still logged + visible via admin audit, not on `/exam-results`.
6. **Re-scan / Reset camera button on `/scan`**: yes, add it. Re-mounts the qr-scanner component on click. iOS Safari sometimes freezes the camera after backgrounding; this is a cheap resilience win.

---
Step 0 — READ THESE FIRST (in this order)

1. `CLAUDE.md` — every rule. Highlights:
   - Anon key only in `apps/web`. NO `SUPABASE_SERVICE_ROLE_KEY`.
   - Every privileged write through an edge fn.
   - **Every teacher-side mutation in builders/results/offline/roster goes through `quiz-admin-mutate` / `exam-admin-mutate` / `attendance-correct` / etc.** (mobile D-172).
   - Realtime channels MUST be `removeChannel`-cleaned on unmount.
   - Only ONE YouTube player mounted at a time per view.
   - Server is the authority for the exam timer + QR validity.

2. `Phases/00-overview-and-architecture.md` — re-read §4 W-DEC table. Specifically W-11 (`@yudiel/react-qr-scanner`), W-16 (`<input type=file>` for upload), W-18 (`navigator.clipboard` for RTMP), W-22 (realtime cleanup + Query cache integration).

3. **`Phases/phase-4-live-classes-teacher-portal.md` — THIS IS THE SOURCE OF TRUTH for Phase 4 scope.** Read it in full. The "## §J — Acceptance ledger (Phase 4 Track 4A closing — 2026-05-28)" section at the bottom describes what Track 4A delivered. Track 4B's 11 build steps + 6 top-level routes are in the body (steps 9–19 of "Step-by-step build order").

4. `Phases/phase-4-manual-tests.md` — currently has §0 + §A + §B + §M + §N + §O + §P. **You will APPEND §C–§L** for the teacher portal. Mirror the Phase 1/2/3 beginner-friendly format. Target ~1800–2200 lines for the full doc.

5. `Phases/{phase-1,phase-2,phase-3}-manual-tests.md` — exact format to mirror for §C–§L (👉 Do this / ✅ What you should see / ❓ If something looks different ≥2 modes / Result checkboxes + notes).

6. `docs/decisions.md` — quote / honor at minimum: D-152 (teacher batch-scope), D-157/D-169 (top-level routes outside the tab group — quiz-builder, exam-builder, exam-results, offline-scores, roster, live-control), D-164 (tap active pill toggles to unmarked), D-171 (PDF signed URL via edge fn), D-172 (admin server-action mutations always through edge fn so `audit_log` captures before/after), D-173 (no `controls=0` on YT iframe), D-179 (full-recompute regrade), D-190..D-196 (Phase-9 live decisions reused by `/live-control`).

7. **Inventory `apps/web/` before adding anything.** Don't duplicate hooks/components. Reuse `Pill`, `Segmented`, `EmptyState`, `Dialog`, `Sheet`, `Tabs`, `Skeleton`, `AppShell`, `FocusLayout`, `Watermark`, `WrappedYtPlayer`, `useChangePassword`, `formatIstDay/Time`, `invokeEdgeFn/Public`, `useChatChannel` (Track 4A), `useRaiseHand` (Track 4A — has a teacher branch already).

8. **Mobile sources to port from** — open each as you build the matching web screen:
   - `apps/mobile/app/(teacher)/{index,scan,classes,content,quizzes,exams,profile}.tsx`
   - `apps/mobile/app/(teacher)/batch/{index,[id]}.tsx`
   - `apps/mobile/app/{quiz-builder,exam-builder,exam-results,offline-scores,roster,live-control}/[*].tsx`
   - `apps/mobile/features/teacher/*` (if exists), `features/dashboard/useTeacherDashboard.ts`, `features/attendance/*` (scan + roster), `features/quiz/*` + `features/exam/*` (admin mutation hooks), `features/library/*` (teacher curriculum)
   - `apps/mobile/components/teacher/*` (PendingList, BatchHeatmap, TopicMasteryBars, AtRiskList, etc.) + relevant builder components

9. Edge fn + RPC signatures — read each one referenced in the scope doc (`apps/functions/{attendance-*,content-*,quiz-*,exam-*,offline-score-*,session-create-ad-hoc,yt-broadcast-*,chat-delete,chat-ban}/index.ts`) + the `teacher_dashboard` / `teacher_batch_overview` RPCs.

---
🔑 Test accounts (verified live 2026-05-28)

| Account | Email | Password |
|---|---|---|
| **Teacher (main account for Track 4B)** | `review.teacher@fynestudy.app` | `ReviewTeacher#2026` |
| Student | `review.student@fynestudy.app` | `ReviewStudent#2026` |
| Owner admin | `owner@fynestudy.example.com` | `FyneOwner#2026` |
| Extra student (Aarav) | `test.aarav@fynestudy.app` | `TestPass#2026` |
| Extra student (Diya) | `test.diya@fynestudy.app` | `TestPass#2026` |

**Seed:** `pnpm seed:live-manual-test --reset` + `pnpm seed:quiz-manual-test --reset` + `pnpm seed:exam-manual-test --reset` before testing.

**Supabase project:** `orqwyazvcthgxoadfxfv` (ap-south-1). Anon key only — NO service-role.

**HTTPS for webcam:** `getUserMedia` works on `localhost` + Vercel (HTTPS) but NOT on LAN IPs. iOS Safari + Android Chrome on-device QA is carry-over to Phase 5.

---
🛠 What Track 4B BUILDS

Read `Phases/phase-4-live-classes-teacher-portal.md` "Step-by-step build order" steps 9–19 for the authoritative scope. Summary:

**Dep to add:** `pnpm add -F @fynestudy/web @yudiel/react-qr-scanner` (lazy-loaded via `next/dynamic({ ssr: false })`).

**11 build steps:**

9. **(teacher)/ home** — `useTeacherDashboard` (RPC `teacher_dashboard`) → next-class card + attendance CTA, `PendingList` (exams to release + raised-hand count), today's classes, quick actions (Scan / New exam / Upload), batch cards. Desktop multi-column. The existing `app/(protected)/page.tsx` already routes student-vs-teacher based on `active_role` — replace the "Teacher dashboard coming in Phase 4" `<EmptyState>` with a real `<TeacherDashboard>` component.

10. **(teacher)/scan — WEBCAM QR.** `navigator.mediaDevices.getUserMedia` started on a "Start camera" button press (NOT on mount — iOS Safari requires a gesture). Render `@yudiel/react-qr-scanner` lazy-loaded (`dynamic(..., { ssr: false })`). `<ScannerOverlay>` corner brackets. Session dropdown (`useTeacherSessions` filtered to today). On decode: debounce 500ms + suppress same-token duplicates, then call `attendance-qr-verify` via `useScanVerify`. Status→toast map: 200=success+student-name, 400=bad token, 401=session expired, 403=not your session, 404=token unknown, 409=already-marked, 410=token expired, 429=too many attempts. Permission-denied fallback → clear message + `<Link href="/roster/[sessionId]">Open roster</Link>` for manual marking. iOS Safari: `playsinline` + `facingMode: 'environment'`. **Reset camera button** that re-mounts the scanner on click (locked decision #6).

11. **(teacher)/classes** — Today/Upcoming/Past segments (`useTeacherSessions`). Per-row actions: Scan, Roster, Live Control. **ScheduleLiveSheet** (FAB) → `session-create-ad-hoc` with the teacher's default batch (Phase-10 carry-over: default batch must be correct). **AdhocSheet** for non-live sessions. The shared `/classes` route currently renders `StudentClasses` on the student side; add a teacher branch — either by reading `active_role` in the page or by creating a `<TeacherClasses>` component inside `app/(protected)/classes/_components/` that the page picks between based on role.

12. **(teacher)/content** — Upload form. `useTeacherCurriculum` → cascading Course → Subject → Chapter → Topic picker + scope + title + file/URL. Video URL → `content-create-video`. PDF → `<input type="file" accept="application/pdf">` → `content-presign-upload` → PUT to the signed URL (progress bar 0–100% under the file picker) → `content-finalize`. The shared `/content` route currently has an "Coming in Phase 4" empty state — replace with the real form.

13. **(teacher)/quizzes + quiz-builder/[quizId]** — Quizzes list (`useTeacherQuizzes`) → builder (`useQuizBuilder` at top-level `app/quiz-builder/[quizId]/page.tsx`, **FocusLayout outside `(protected)`** per D-169): cascading topic picker + title + duration + question list + Add-from-bank sheet (`useQuestionBank`) + inline question editor + option image upload via `quiz-image-presign` → PUT → finalize + publish toggle. **All writes through `quiz-admin-mutate`** (D-172). Support both "new" and uuid modes.

14. **(teacher)/exams + exam-builder/[examId]** — Exams list (`useTeacherExams`) → builder (`useTeacherExamBuilder` at top-level `app/exam-builder/[examId]/page.tsx`, **FocusLayout**): title + batch (`useTeacherBatches`) + start time + duration + release type (instant/manual) + questions. Edit-after-publish warning Dialog. **Atomic question-replace** (Phase-7 carry-over — the builder replaces ALL questions in ONE server transaction; never per-question piecemeal that could leave a half-built exam). Writes via `exam-admin-mutate`.

15. **exam-results/[examId]** (top-level **FocusLayout outside `(protected)`**) — `useExamResultsBoard` → attempts table with student name + score + submitted-at + question-level correct%. **Release** button → `exam-release-results`. **Regrade** button → Dialog with two modes: change-correct-option / mark-all-correct. Both go through `exam-regrade` (full-recompute per D-179; no delta drift). Surface the regrade result inline ("X attempts updated").

16. **offline-scores** (top-level **FocusLayout**) — Batch picker (`useTeacherBatches`) + test name + date + subject + max marks + roster score inputs (`useOfflineScores`). Save all → `offline-score-upsert` (one call with the full array).

17. **(teacher)/batch + batch/[id]** — `(teacher)/batch` lists the teacher's assigned batches (`useAssignedBatches`). `batch/[id]` opens analytics tabs Risk / Mastery / Attendance (`useTeacherBatchOverview` RPC): `<AtRiskList>` (composite < 0.4 per D-200), `<TopicMasteryBars>`, `<BatchHeatmap>`. The shared `/batch` route currently has an empty state — replace.

18. **roster/[sessionId]** (top-level **FocusLayout**) — `useRoster` realtime `teacher-roster-{sessionId}` channel → `<RosterRow>` per student with P/L/A pills + correction Dialog (preset reasons) → `attendance-correct` / `attendance-manual-mark` / `attendance-unmark` / `attendance-bulk-mark`. **D-164: tap active pill toggles to unmarked.** Make sure the channel is `removeChannel`-cleaned on unmount.

19. **live-control/[sessionId]** (top-level **FocusLayout**) — Two stages:
    - **Setup** (broadcast not yet created): form with title + description + "Create broadcast" button → `yt-broadcast-create`. **Inline error card + Retry button + keep form state** on failure (locked decision #4). On success: show RTMP server + stream key with `navigator.clipboard.writeText()` **Copy buttons** for the OBS handoff. **Stream key is NEVER persisted in React Query cache or localStorage — use component-local `useState` only.** Then "Go Live" button → `yt-broadcast-golive` (flips `sessions.status='live'`).
    - **Live**: **Tabbed view** (locked decision #3) — `Stream` tab embeds `WrappedYtPlayer` on the same broadcast (so only one player mounts per view); `Moderate` tab shows chat (`useChatChannel`) with moderation buttons per message (delete via `chat-delete`, ban author via `chat-ban`) + raise-hand queue (`useRaiseHand` teacher branch) with "Mark resolved" buttons + pinned-announcement composer (uses `chat-channel.post(body, 'announcement')`). "End class" button → `yt-broadcast-stop` (flips `sessions.status='ended'` + posts a `kind='system'` chat message that flips student screens to the recording-ready view per Track-4A's end-of-class handler).
    - Stream key idempotent re-fetch via `boundStreamId` if the teacher navigates away + comes back.

**Middleware update:** the top-level teacher routes (`quiz-builder/[quizId]`, `exam-builder/[examId]`, `exam-results/[examId]`, `offline-scores`, `roster/[sessionId]`, `live-control/[sessionId]`) live OUTSIDE `(protected)`. Add them to `middleware.ts`'s teacher-only path-prefix list so non-teachers are redirected to `/`. `/live/[sessionId]` and `/recording/[sessionId]` are NOT teacher-only — Track 4A intentionally left them open to both roles.

---
❌ What Track 4B does NOT build

- Sentry + PostHog (Phase 5).
- Vercel deploy + CORS extension + Supabase Auth redirect-URL allowlist for `web-*.vercel.app` (Phase 5).
- iOS Safari + Android Chrome on-device QA — needs HTTPS (Phase 5).
- Multi-role + suspended account creation (Phase 1 carry-over).
- Any change to edge functions, RPCs, RLS, or Supabase schema. **Track 4B is FRONT-END ONLY.** If you think a backend change is needed, STOP and ask the user.
- Real OBS streaming dry-run — the user runs this themselves in §G of the manual test plan.

---
🔒 Locked decisions + hard rules — SAME as Track 4A (do not regress)

| Topic | Rule |
|---|---|
| Anon key only in `apps/web` | Service-role key NEVER appears. Re-grep `.next/static` after build. |
| `is_correct` MUST NOT leak (Phase-3 invariant) | The Phase-3 `cacheKeySecurity.test.ts` will fail if any attempt-stage source references `is_correct`. Builders DO see correctness server-side (they're the question author surface) but only via `quiz-admin-mutate` / `exam-admin-mutate`. The student attempt path NEVER sees it. |
| Server is the timer / QR / scan authority | `attendance-qr-verify` is the gate. Webcam decodes; server validates. |
| Webcam needs HTTPS + a user gesture | Start camera on a button press, not on mount. iOS Safari: `playsinline` + `facingMode: 'environment'`. |
| Realtime cleanup is mandatory | Every `supabase.channel(…)` MUST have a matching `removeChannel(…)`. Extend the Track-4A `realtimeCleanupAudit.test.ts` to scan `features/teacher/*` as well. |
| Only ONE YouTube player per view | Live-control uses tabs to satisfy this. |
| Chat = direct RLS insert | Track 4A pattern. NOT an edge fn for posting. Trigger overrides author + enforces rate-limit. Don't write `author_name` from the client. |
| Stream key NEVER persisted | Use component-local `useState` only — no React Query cache, no localStorage. |
| `controls=0` FORBIDDEN on YT iframe | D-173. Native YouTube controls only. |
| `attendance-qr-verify` 500ms debounce + dedup | Multiple rapid QR frames within 500ms send only ONE verify; suppress same-token duplicates. |
| Teacher batch-scope (D-152) | Any join through `students(app_users!user_id(full_name))` requires the teacher's RLS batch-scope. |
| **D-172 audit** | Every teacher-side mutation in builders / results / offline / roster goes through an edge fn so `audit_log` captures before/after. |
| FocusLayout for top-level teacher routes | `quiz-builder`, `exam-builder`, `exam-results`, `offline-scores`, `roster`, `live-control`. |
| Git branch | Continue on `web-phase-1`. Commit at end: `feat(web-phase-4): teacher portal (Track 4B)`. Do NOT push or merge to main. |

---
🚫 Anti-patterns specific to Track 4B

1. **Caching the stream key.** Use `useState` only.
2. **Auto-starting the webcam on mount.** Require a button press.
3. **Showing camera-permission error as a dead-end.** Always offer the manual-mark roster fallback link.
4. **Calling `attendance-qr-verify` on every decoded frame.** Debounce 500ms + suppress same-token duplicates.
5. **Sending `correct_option_id` in any student-facing query.** Builders see correctness server-side via the edge fns — legitimate.
6. **Mixing realtime channel names.** Use `teacher-roster-{sessionId}` for roster; `chat-{sessionId}` / `hands-{sessionId}` / `bans-{sessionId}` / `ban-{sessionId}-{userId}` for live-control. Each has a separate cleanup.
7. **Mounting two YT players in live-control.** The tabbed view satisfies this.
8. **Skipping chat reconnect-reload.** Track-4A's `useChatChannel` already handles it — just reuse the hook.
9. **Per-question piecemeal builder saves.** Use atomic replace (one server transaction).
10. **Bypassing the teacher-only middleware gate.** Add the new top-level teacher routes to the teacher-only list in `middleware.ts`.

---
✅ Verification — every box must tick before manual test doc

```powershell
pnpm --filter @fynestudy/web typecheck   # 0 errors
pnpm --filter @fynestudy/web lint        # 0 errors, 0 warnings
pnpm --filter @fynestudy/web test        # all unit tests green
pnpm --filter @fynestudy/web build       # 35+ routes, no Attempted import error
```

Unit tests to write (Vitest, under `apps/web/features/teacher/__tests__/`):
- `scanToastMapper.test.ts` — status → toast text (200/400/401/403/404/409/410/429).
- `rosterCorrectionState.test.ts` — pill state transitions (D-164: tap active toggles to unmarked).
- `builderQuestionReplace.test.ts` — Phase-7 atomic replace logic.
- `offlineScoreValidation.test.ts` — zod schema for the score form.
- `raiseHandQueue.test.ts` — FIFO ordering; resolve + ban pop the user out.
- `cameraGesture.test.ts` — assert `getUserMedia` is NOT called until the Start button is pressed.

The Track-4A `realtimeCleanupAudit.test.ts` will automatically pick up new `features/teacher/*.ts` files; ensure parity (every `.channel(` paired with `.removeChannel(`).

E2E (Playwright, extend `apps/web/e2e/`):
- `teacher-scan.spec.ts` — `page.addInitScript` to stub `navigator.mediaDevices.getUserMedia` + `page.route('**/functions/v1/attendance-qr-verify', …)` returning 200; assert success toast. Denied permission → fallback link visible.
- `teacher-builders.spec.ts` — quiz + exam builder happy path with mocked presign + finalize responses.
- `teacher-results.spec.ts` — release + regrade (mock the edge fn responses).
- `live-control.spec.ts` — create broadcast (mock the YT edge fns), Copy buttons (assert `navigator.clipboard.writeText` was called), go-live transition, end-class transition.
- `teacher-classes.spec.ts` — Schedule-Live + Ad-hoc sheets (mock `session-create-ad-hoc`).

Manual gates (script + grep):
- Realtime cleanup parity: same source-scan as Track 4A — now also covers `features/teacher/*`.
- No-service-role-key grep on `.next/static`.
- Phase-3 `cacheKeySecurity.test.ts` still green (no `is_correct` regression in attempt-stage code).

Seed before manual + E2E:
```powershell
pnpm seed:live-manual-test --reset
pnpm seed:quiz-manual-test --reset
pnpm seed:exam-manual-test --reset
```

---
📋 Manual test doc requirement

APPEND §C–§L to `Phases/phase-4-manual-tests.md` (which currently has §0 + §A + §B + §M + §N + §O + §P). Mirror the Phase 1/2/3 beginner-friendly format precisely:

1. Per-test format (mandatory for every numbered test):
   - `### Test ID — short name`
   - **👉 Do this:** numbered substeps (URLs, button labels, fields verbatim).
   - **✅ What you should see:** bullets with specific UI text + visuals.
   - **❓ If something looks different:** ≥2 failure modes with diagnostic hints.
   - `Result:` [ ] PASS · [ ] FAIL · [ ] N/A + a blank line for the user's notes.

2. Sections to add:
   - **§C Teacher home dashboard** — RPC card layout, PendingList, quick actions.
   - **§D Teacher scan (webcam QR)** — Start camera button, decode a real QR (open `/attendance` on a second device + show the rotating QR + scan), success/fail toasts, permission-denied fallback link to roster, Reset camera button.
   - **§E Teacher classes** — Today/Upcoming/Past + Schedule-Live + Ad-hoc.
   - **§F Teacher content upload** — Video URL + PDF presign+PUT+finalize with progress bar.
   - **§G Teacher live control + REAL OBS DRY-RUN** — create broadcast, copy RTMP into OBS Studio (give the user click-by-click OBS setup instructions: Settings → Stream → Server: copy the RTMP server URL, Stream key: copy the stream key, Apply, Start Streaming), go live, student joins from another device, moderate (delete a msg, ban a user, pin an announcement), end class, verify the student screen pivots to the recording-ready view. This is the most important section.
   - **§H Teacher quiz builder** — list + builder + cascading topic picker + Add-from-bank + option image upload + publish toggle.
   - **§I Teacher exam builder + results + regrade** — list, builder (instant + manual release), release a manual exam, regrade (change-correct + mark-all-correct).
   - **§J Teacher offline scores** — batch picker + roster save → student-side appears in their profile.
   - **§K Teacher batch analytics** — Risk/Mastery/Attendance tabs populate.
   - **§L Roster corrections** — pill marks + correction Dialog + tap-active-toggles-to-unmarked (D-164) + realtime sync (a second scan from another teacher device updates the roster in real time).

3. Update §M (add a "Track 4B mutations all go through edge fns + audit_log rows written" check), §N (add the builders + roster + live-control to the 320px→1440px sweep), §O (add the new vitest counts + Playwright spec names), §P (add tickboxes for §C–§L).

Target total: ~1800–2200 lines for the full doc.

🛑 Wait for the user to sign off the FULL manual plan (§A through §L + §M + §N + §O) before declaring Phase 4 accepted.

---
📝 Acceptance — when Phase 4 is DONE

1. Every checkbox in `Phases/phase-4-live-classes-teacher-portal.md`'s "Acceptance criteria" section ticked.
2. REPLACE the existing "## §J — Acceptance ledger (Phase 4 Track 4A closing — 2026-05-28, code-complete pending manual QA)" section at the bottom of `Phases/phase-4-live-classes-teacher-portal.md` with a full "## §J — Acceptance ledger (Phase 4 closing — YYYY-MM-DD, code-complete pending manual QA)" section covering BOTH tracks.
3. Update `CLAUDE.md`'s "🌐 Web App Conversion track" — change the "Phase 4 Track 4A code-complete" line to "Phase 4 ✅ code-complete YYYY-MM-DD" with a one-sentence summary covering both tracks; bump the header to "(in progress — Phase 4 code-complete YYYY-MM-DD)".
4. UPDATE the memory file at `C:\Users\kaust\.claude\projects\C--Users-kaust-OneDrive-Desktop-FyneStudyLive\memory\project_web-phase-4-status.md` with the Track 4B section + the full Phase-4 summary. Update the `MEMORY.md` pointer line accordingly.
5. Commit on `web-phase-1` (same long-lived branch): `feat(web-phase-4): teacher portal (Track 4B)`. Do NOT push or merge to main.

---
🛑 Stop condition

When Phase 4 is fully accepted (Track 4B implemented + every acceptance criterion green + manual tests signed off by the user + ledger replaced + CLAUDE.md updated + memory file updated + commit landed on `web-phase-1`), STOP. Do NOT start Phase 5. The user will open a new conversation with the Phase 5 prompt.

---
🤝 If anything is ambiguous

ASK THE USER FIRST. Specifically expect ambiguity in:

- The exact UI for the offline-scores roster grid (column order, what to do when a student has a prior score saved — overwrite vs warn before overwriting).
- Whether the quiz/exam builders should support drag-to-reorder questions (mobile uses arrow buttons; web could use the same OR drag-and-drop — confirm).
- Whether the live-control "End class" button should require a confirmation Dialog (mobile does; recommend mirroring).
- The exact moderation menu UX in live-control — mobile uses a long-press; web should use a `⋯` button on each chat message that opens a `<DropdownMenu>` with Delete + Ban options (confirm).
- Whether the teacher batch analytics page should be `(teacher)/batch/[id]` (inside `(protected)` → AppShell side-rail stays) or top-level outside `(protected)` (FocusLayout). Mobile keeps it inside the tab group. Recommend mirroring mobile (inside `(protected)`).
- Whether the `useTeacherDashboard` should auto-refresh on window focus (mobile does; recommend mirroring) and how often to poll the PendingList for new raised hands (recommend: realtime via the existing `hands-*` channels rather than polling).

The project's CLAUDE.md first line says: "Every time you code, don't just guess. Be precise; if you have any doubts then ask me." Honor that.

---
Sanity-check after reading the above: if you find any conflict between this prompt and `Phases/phase-4-live-classes-teacher-portal.md`, the **phase doc wins for scope**; this prompt wins for **process**. Ask if it's still unclear.

Begin.

---

## How to use this prompt

1. Open a brand-new Claude Code conversation in this same repo (open a new tab in the Claude Code IDE/extension, or `Win+R → wt → claude` if you use the CLI).
2. Paste the entire block above (from `I'm continuing the FyneStudy…` through `Begin.`) as the very first message.
3. The new Claude will read every file the prompt references, then start building Track 4B. It will skip Track 4A's existing files unless it finds a real bug, install `@yudiel/react-qr-scanner`, and append §C–§L to `Phases/phase-4-manual-tests.md` mirroring Phase 1/2/3's format.
4. Track 4B is roughly 2× the size of Track 4A (11 build steps + 6 top-level routes vs. 2 routes for Track 4A). Expect 1–2 work sessions. If the new Claude proposes to split Track 4B further into sub-tracks, let it — that's the right pattern.
5. If you get stuck mid-build, paste back: "Re-read `Phases/PHASE-4B-KICKOFF-PROMPT.md` — you missed §<section>."
