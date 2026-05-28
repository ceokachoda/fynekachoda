# Phase 4 — Live Classes + Teacher Portal

> **Prerequisite:** Phase 3 accepted. This is the **largest** phase: it finishes the student side (live classes + recordings) and builds the **entire teacher experience**, including the browser-based QR attendance scanner. After this phase the web app is at **full feature parity** with the mobile app (hardening happens in Phase 5).

> Because this phase is big, build it in the **two sub-tracks** below and QA each before combining. If you prefer, split your work sessions: 4A (live + recordings) then 4B (teacher portal).

---

## Goal / Definition of Done

**Students:** join a **live class** (lobby countdown → wrapped YouTube player + realtime chat + raise-hand + pinned announcement + end-of-class), and watch **recordings** (player + time-synced chat replay + playback-rate).

**Teachers:** do everything the mobile teacher app does —
1. **Home** dashboard (next class, pending releases, today's schedule, batch cards).
2. **Scan** student QR for attendance **via the webcam** (browser).
3. **Classes:** today/upcoming/past, schedule a live class, create ad-hoc sessions, open roster / live-control.
4. **Content/Library:** upload videos (URL) and PDFs (file → presign → finalize).
5. **Quizzes** list + **quiz-builder** (question bank, option-image presign, publish).
6. **Exams** list + **exam-builder** + **exam-results** (release + regrade) + **offline-scores**.
7. **Batch** list + **batch analytics** (risk / mastery / attendance heatmap).
8. **Roster** corrections; **Live control** (RTMP copy, go-live, moderation, raise-hand queue, end class).

---

## Prerequisites
- Phase 3 acceptance ticked.
- Seed: `pnpm seed:live-manual-test --reset` (LIVE + UPCOMING + ENDED sessions on a real video), a teacher assigned to ≥1 batch with students, a draft quiz + exam, content curriculum.
- **YouTube is already provisioned** (Vault secrets on the dev "NOvA FX" channel) — `yt-*` edge fns return real keys. For a real live dry-run you need OBS pointed at the RTMP target.
- **HTTPS** is required for the webcam scanner (works on `localhost` and the Vercel domain; not on plain-http LAN IPs).

---

## Scope

### Screens
| Web route | Mirrors mobile | Tier |
|---|---|---|
| `live/[sessionId]` (FocusLayout) | `app/live/[sessionId].tsx` | Highly complex (player + realtime) |
| `recording/[sessionId]` (FocusLayout) | `app/recording/[sessionId].tsx` | Complex (player + replay sync) |
| `(teacher)/` home | `(teacher)/index.tsx` | Complex |
| `(teacher)/scan` | `(teacher)/scan.tsx` | Complex (**webcam QR**) |
| `(teacher)/classes` | `(teacher)/classes.tsx` | Complex |
| `(teacher)/content` | `(teacher)/content.tsx` | Stateful form (upload) |
| `(teacher)/quizzes` + `quiz-builder/[quizId]` | `(teacher)/quizzes.tsx`, `app/quiz-builder/[quizId].tsx` | Highly complex builder |
| `(teacher)/exams` + `exam-builder/[examId]` | `(teacher)/exams.tsx`, `app/exam-builder/[examId].tsx` | Highly complex builder |
| `exam-results/[examId]` (FocusLayout) | `app/exam-results/[examId].tsx` | Complex (release/regrade) |
| `offline-scores` (FocusLayout) | `app/offline-scores.tsx` | Stateful form |
| `(teacher)/batch` + `batch/[id]` | `(teacher)/batch/index.tsx`, `batch/[id].tsx` | Complex analytics |
| `roster/[sessionId]` (FocusLayout) | `app/roster/[sessionId].tsx` | Stateful (corrections) |
| `live-control/[sessionId]` (FocusLayout) | `app/live-control/[sessionId].tsx` | Highly complex |
| `(teacher)/profile` | `(teacher)/profile.tsx` | Simple |

### Components (port from mobile)
- **live/**: `LobbyCountdown`, `ChatPane`, `ChatComposer`, `RaiseHandButton`, `PinnedBanner`, `ChatReplay`, `WrappedYtPlayer` (web).
- **teacher/**: `ScannerOverlay`, `RosterRow`, `AdhocSheet`, `ScheduleLiveSheet`, `PendingList`, `BatchHeatmap`, `TopicMasteryBars`, `AtRiskList`.

### Hooks ported (→ TanStack Query)
**Live/chat:** `useLiveSession` (poll while scheduled), `usePlaybackSign` (`kind:'live'|'recording'`), `useChatChannel` (realtime `chat-{id}` + insert messages), `useRaiseHand` (`hands-{id}`), `useSessionState` (own ban `ban-{id}-{uid}`), `useSessionBans` (`bans-{id}`), `chat-replay` utils.
**Teacher:** `useTeacherDashboard` (RPC), `useTeacherSessions`, `useTeacherBatches`, `useAssignedBatches`, `useTeacherBatchOverview` (RPC), `useRoster` (realtime `teacher-roster-{id}`), `useCameraPermission` (→ web getUserMedia), `useScanVerify` (`attendance-qr-verify`), `useTeacherCurriculum`, `useTeacherQuizzes`, `useQuizBuilder`, `useQuestionBank`, `useTeacherExams`, `useTeacherExamBuilder`, `useBatchSubjects`, `useExamResultsBoard`, `useOfflineScores`.

### Edge fns / RPC / realtime
- **Live:** `yt-broadcast-create`, `yt-broadcast-golive`, `yt-broadcast-stop`, `yt-playback-sign`, `chat-delete`, `chat-ban`.
- **Attendance:** `attendance-qr-verify`, `attendance-correct`, `attendance-bulk-mark`, `attendance-manual-mark`, `attendance-unmark`, `session-create-ad-hoc`.
- **Content:** `content-presign-upload`, `content-finalize`, `content-create-video`, `content-toggle-publish`, `content-delete`, `yt-thumb-sign`.
- **Quiz/Exam builders + results:** `quiz-admin-mutate`, `quiz-image-presign`, `exam-admin-mutate`, `exam-release-results`, `exam-regrade`, `offline-score-upsert`.
- **RPC:** `teacher_dashboard`, `teacher_batch_overview`.
- **Realtime:** `chat-{id}`, `hands-{id}`, `bans-{id}`, `ban-{id}-{uid}`, `teacher-roster-{id}`.

---

## Step-by-step build order

### Track 4A — Live classes + recordings (student-facing)

1. **`live/[sessionId]`** (FocusLayout): `useLiveSession` (polls every 10s while `scheduled`). Stages: **lobby** (`LobbyCountdown` — dark screen, subject, countdown, "waiting" spinner) until `status='live'`; then **live** (`WrappedYtPlayer` web via `react-youtube` + `Watermark`).
2. **Chat** (`useChatChannel`, realtime `chat-{id}` INSERT/UPDATE): `ChatPane` (filter soft-deleted) + `ChatComposer`. Posting is a **direct RLS insert** with author identity; the server trigger enforces the 5-msgs/30s rate-limit + denormalizes author name/role. Show the disabled-reason when banned/not-live.
3. **Raise hand** (`useRaiseHand`, `hands-{id}`): toggle button; **banned students can't raise** (carried Phase-9 RLS fix).
4. **Pinned announcement** (`PinnedBanner`) + **end-of-class** are `chat_messages` rows with a `kind` — render specially.
5. **Own ban** (`useSessionState`, `ban-{id}-{uid}`): if banned, disable composer + raise-hand live.
6. **Reconnect** (carried Phase-9 fix): on realtime reconnect, reload chat history so no messages are missed.
7. **`recording/[sessionId]`** (FocusLayout): `usePlaybackSign(kind:'recording')` → player with `playbackRate` (1x/1.5x/2x); `ChatReplay` reveals messages by current player time (offset sync from `chat-replay.ts`), auto-scroll on new.
8. **Cleanup:** `removeChannel` for every channel on unmount; only one player mounted (W-22 + performance rule). Wire `(student)/classes` Live/Upcoming/Recorded segments to these routes.

### Track 4B — Teacher portal

9. **`(teacher)/` home:** `useTeacherDashboard` (RPC) → next-class card + attendance CTA, `PendingList` (exams to release + raised-hand count), today's classes, quick actions (Scan / New exam / Upload), batch cards. Desktop = multi-column.
10. **`(teacher)/scan` (webcam QR):** port `useCameraPermission` to **`navigator.mediaDevices.getUserMedia`**; render `@yudiel/react-qr-scanner` (lazy-loaded) inside `ScannerOverlay` (corner brackets + tone). Session dropdown (which class). On decode → `useScanVerify` → `attendance-qr-verify` (500ms debounce; handle 400/401/403/404/409/429 with the same toasts as mobile). **Permission-denied fallback:** show a clear message + a link to open the **roster** for manual marking. "Open roster" button → `/roster/[sessionId]`.
11. **`(teacher)/classes`:** Today/Upcoming/Past segments (`useTeacherSessions`) with status badges + per-row actions (Scan, Roster, Live Control). **Schedule Live** (`ScheduleLiveSheet` → `session-create-ad-hoc`, default to the teacher's batch — carried Phase-10 fix) + **Ad-hoc** (`AdhocSheet`). On web these are `Dialog`/`Sheet`.
12. **`(teacher)/content` upload:** form (Kind Video/PDF/Note → Course → Subject → Chapter → Topic → Scope → Title → file/URL) via `useTeacherCurriculum`. Video URL → `content-create-video`. PDF → **`<input type="file">`** → `content-presign-upload` → **PUT to the signed URL** → `content-finalize` (show a progress bar from the fetch upload). (W-16.)
13. **`(teacher)/quizzes` + `quiz-builder/[quizId]`:** list (`useTeacherQuizzes`) → builder (`useQuizBuilder`): title/duration/topics, question list, add-from-bank (`useQuestionBank`), inline question editor, **option images** via `quiz-image-presign` → PUT, publish toggle. All writes through **`quiz-admin-mutate`** (D-172). "new" vs uuid mode.
14. **`(teacher)/exams` + `exam-builder/[examId]`:** list (`useTeacherExams`) → builder (`useTeacherExamBuilder`): title, batch (`useTeacherBatches`), start time, duration, release type (instant/manual), questions; edit-after-publish warning; atomic question-replace (carried Phase-7 fix). Writes via **`exam-admin-mutate`**.
15. **`exam-results/[examId]`** (FocusLayout): `useExamResultsBoard` → attempts table with scores + question-level correct%; **Release** (`exam-release-results`) + **Regrade** (`exam-regrade`: change-correct / mark-all-correct, full-recompute per D-179) in a `Dialog`.
16. **`offline-scores`** (FocusLayout): batch picker + test name/date/subject/max + roster score inputs (`useOfflineScores`) → **Save all** via `offline-score-upsert`.
17. **`(teacher)/batch` + `batch/[id]`:** list of assigned batches → analytics tabs Risk / Mastery / Attendance (`useTeacherBatchOverview` RPC): `AtRiskList` (composite < 0.4), `TopicMasteryBars`, `BatchHeatmap`.
18. **`roster/[sessionId]`** (FocusLayout): `useRoster` (realtime `teacher-roster-{id}`) → `RosterRow` per student with P/L/A pills + correction `Dialog` (preset reasons) → `attendance-correct` / `attendance-manual-mark` / `attendance-unmark` / `attendance-bulk-mark`. Tap active pill toggles to unmarked (mobile D-164).
19. **`live-control/[sessionId]`** (FocusLayout): 
    - **Setup:** "Create broadcast" (`yt-broadcast-create`) → show **RTMP server + stream key** with **Copy buttons** (`navigator.clipboard`) for the OBS handoff. **Go Live** (`yt-broadcast-golive` — flips `sessions.status='live'`).
    - **Live:** player preview + viewer count; moderated chat (`useChatChannel` + long-press/▾ menu → `chat-delete`, `chat-ban`); raise-hand queue (`useRaiseHand` teacher mode + `useSessionBans`); pin announcement composer; **End class** (`yt-broadcast-stop`).
    - Stream key is **never persisted** (idempotent re-fetch via `boundStreamId`) — keep that behavior.

---

## Gotchas / carried-over decisions
- **Webcam needs HTTPS + a user gesture.** Start the camera on a button press, not on mount. Handle "no camera / denied" gracefully → manual roster fallback. iOS Safari: `playsinline` + `getUserMedia` constraints `{ facingMode: 'environment' }` for rear camera on phones.
- **Realtime cleanup is mandatory** — every `channel` gets a `removeChannel`. Live-control + live are the worst offenders for ghost subscriptions; verify on unmount.
- **Only one YouTube player mounted at a time** (performance). Live preview in live-control + the student live player are different sessions/screens — fine, but don't mount two in one view.
- **Chat is a direct RLS insert** (not an edge fn) with the rate-limit + denormalize enforced by the SECURITY DEFINER trigger. Don't try to "help" by also writing author fields from the client.
- **Banned students:** can't raise hands, can't post; reflect live via `useSessionState` (Phase-9 RLS fix).
- **`yt-playback-sign` 409** = not live/not ready → keep the lobby/poll loop; don't show an error.
- **Teacher embeds need the batch-scope join** (mobile D-152): reading student names via `students(app_users!user_id(full_name))` requires the teacher's RLS batch-scope — already in the backend; just use the same select shapes as the mobile hooks.
- **`controls=0` is still forbidden** on the YT iframe (D-173) — keep native controls.
- **Three staged Phase-9 edge-fn guards** (golive-cancelled, stop-dup-message, yt-api retry-split) are a *backend* deploy item tracked in Phase 12 of the mobile build — not a web task, but be aware the deployed `yt-*` fns may update.

## Automated tests
- Unit: chat-replay offset sync; scan-result status→toast mapping; roster correction state; builder question-replace; offline-score validation; raise-hand queue ordering.
- E2E (Playwright):
  - Student live: lobby → (simulate `status='live'`) → player + chat insert (rate-limit respected) + raise-hand; banned user can't post/raise.
  - Recording: replay reveals messages by time; playbackRate changes.
  - Teacher: schedule live (default batch correct); upload a PDF (presign→PUT→finalize); build+publish a quiz (image presign) and an exam; release + regrade an exam; offline scores save; roster correction; live-control create→copy key→go-live→end.
  - **Webcam QR:** mock `getUserMedia` + feed a known QR frame → assert `attendance-qr-verify` called + success toast; denied permission → fallback shown.

## Manual test checklist (Chrome desktop + iOS Safari + Android Chrome)
1. **Student live** (with a real or simulated live session): lobby countdown → player plays → send chat (rate-limit kicks in at 6th msg/30s) → raise/lower hand → see pinned announcement → end-of-class message.
2. **Recording:** plays; chat replay reveals in sync; 1.5x/2x work.
3. **Teacher scan:** grant camera → scan a student's QR (from a second device showing the student attendance screen) → success toast → student's row flips present; deny camera → fallback to roster.
4. **Schedule live + ad-hoc** create sessions on the right batch; they appear in student Classes.
5. **Content upload:** video URL publishes; PDF file uploads with progress + appears in the library.
6. **Quiz builder:** add bank questions + an option image; publish; it shows for students.
7. **Exam builder:** create instant + manual exams; **release** a manual exam → student sees the result (ties to Phase 3 test 3); **regrade** updates scores.
8. **Offline scores** save and show on the student side.
9. **Batch analytics:** risk/mastery/attendance tabs populate.
10. **Roster:** mark/correct/unmark; updates realtime if a second scan happens.
11. **Live control (real dry-run):** create broadcast → copy RTMP key into OBS → go live → student sees it live → moderate (delete a msg, ban a user) → end class.
12. Resize everything 320px↔1440px; webcam scanner usable on a phone (rear camera).

## Acceptance criteria
- [x] Student live + recording fully work (player, realtime chat, raise-hand, replay, bans, reconnect-reload) — Track 4A ✅ code-complete 2026-05-28.
- [ ] All 8 teacher tabs + 6 teacher top-level screens work and match mobile behavior — Track 4B pending.
- [ ] Webcam QR scan marks attendance; permission-denied fallback works; HTTPS verified — Track 4B pending.
- [ ] Builders/results/offline/roster/live-control all route through the correct edge fns; audit rows written — Track 4B pending.
- [x] All realtime channels cleaned up on unmount (Track 4A — chat-{id}, hands-{id}, ban-{id}-{uid}); one player at a time — automated audit at `apps/web/features/live/__tests__/realtimeCleanupAudit.test.ts`.
- [x] Typecheck/lint/test/build green for Track 4A; E2E specs landed (live-student, recording).
- [ ] Manual checklist (incl. one real OBS dry-run) passes on all three browsers — partial: Chrome desktop ready for §A + §B; §G OBS dry-run is Track 4B.
- [ ] **Web app is now at full feature parity with the mobile app** — Track 4B will close this.

---

## §J — Acceptance ledger (Phase 4 Track 4A closing — 2026-05-28, code-complete pending manual QA)

### Code shipped (apps/web) — Track 4A only

**New top-level routes (2)** — both outside the `(protected)` group so the side-rail / bottom-tabs don't render (W-23 / mobile D-169):
- `apps/web/app/live/[sessionId]/page.tsx` + `_components/LiveClient.tsx` — wrapped YouTube player + Watermark + Lobby countdown (when scheduled) + realtime chat + raise-hand + own-ban + pinned-announcement + end-of-class detection. Responsive layout: split player|chat on desktop (≥ lg), stacked on narrow.
- `apps/web/app/recording/[sessionId]/page.tsx` + `_components/RecordingClient.tsx` — wrapped player + Watermark + native YouTube controls + custom Speed 1× / 1.5× / 2× pills + time-synced ChatReplay (offset = `posted_at - started_at`). The replay reveals faster at higher speeds automatically because it keys off the player's *actual* position.

**New feature hooks (5)** — all under `apps/web/features/`:
- `features/live/useLiveSession.ts` — single session row; polls every 10s while `status='scheduled'` (sessions table is not in the Realtime publication).
- `features/live/useLivePlaybackSign.ts` — `yt-playback-sign` by `session_id + kind` (separate from `features/library/useYtPlayback` which keys on `content_id`). 409 is a NORMAL "not ready" state, surfaced via `status`.
- `features/live/useRaiseHand.ts` — `hands-{id}` channel; student raise/lower + teacher queue with denormalized names (D-152). Pairs `.channel(` and `.removeChannel(`.
- `features/live/useSessionState.ts` — `ban-{id}-{uid}` channel; own-ban live state; flips composer + raise-hand to disabled when banned.
- `features/chat/useChatChannel.ts` — `chat-{id}` channel (INSERT + UPDATE for soft-delete) + history load + Phase-9 reconnect-reload + direct RLS insert for posting (the SECURITY DEFINER trigger stamps author + enforces 5/30s rate-limit; the client MUST NOT send `author_name`).

**New pure utilities (1)**:
- `features/live/chat-replay.ts` — `computeReplayOffsetSec`, `withReplayOffsets`, `messagesUpTo`, `countBetween`. No React imports → Vitest imports directly without jsdom.

**New components (6)** under `apps/web/components/live/`:
- `LobbyCountdown.tsx` — dark `#0f172a` background, radio icon, subject name, countdown MM:SS / HH:MM:SS, then "Waiting for the teacher to go live…" spinner.
- `ChatPane.tsx` — message list with `MessageBubble` per row (initials avatar, role badge, IST timestamp, body). Filters `kind='chat'` and `!is_deleted`. Auto-scrolls.
- `ChatComposer.tsx` — textarea + send button. Enter sends; Shift+Enter inserts newline. Disabled-state with reason text when banned / not-live.
- `RaiseHandButton.tsx` — blue → amber toggle with Hand icon.
- `PinnedBanner.tsx` — blue-50 tinted banner with Pin icon + "PINNED BY <name>" label + body.
- `ChatReplay.tsx` — uses `withReplayOffsets` + `messagesUpTo`; memoized so the recording screen's 1×/s `currentSec` tick only re-renders when a new message is revealed.

**Extended components**:
- `components/player/WrappedYtPlayer.tsx` — refactored to `forwardRef<WrappedYtPlayerHandle, …>` with imperative `play / pause / seekTo`. New optional props: `playbackRate`, `onPlayingChange`, `onDuration`, `onPosition`. The Phase-2 video screen still works without changes (all new props optional).

**Discovery wiring (1 file edited)**:
- `app/(protected)/classes/_components/StudentClasses.tsx` — `Live` segment cards now `<Link href="/live/{id}">`; `Recorded` segment cards now `<Link href="/recording/{id}">`. The "Phase 4 placeholder" pill + copy were removed.

**Dependencies added**: **none** (Track 4A reuses `react-youtube`, `@supabase/ssr`, `@supabase/supabase-js`, `@tanstack/react-query`, `lucide-react` — already installed). `@yudiel/react-qr-scanner` will be added in Track 4B for the teacher scan page.

### Tests

- **Unit (Vitest):** 117/117 pass across 17 files. Phase-4 Track-4A additions:
  - `features/live/__tests__/chat-replay.test.ts` — 14 tests covering `computeReplayOffsetSec` (positive / negative-clamped / equal), `withReplayOffsets` (attach + sort + non-mutation), `messagesUpTo` (boundary inclusive / pre-start defensive / past-end), `countBetween` (open-from + closed-to, empty range, 1ms epsilon symmetry).
  - `features/live/__tests__/realtimeCleanupAudit.test.ts` — 11 tests (one per file in `features/{live,chat,teacher,attendance}/`); each asserts `.channel(` calls equal `.removeChannel(` calls after comments + string literals are stripped. Catches the mobile-era "ghost subscription" foot-gun.
- **E2E (Playwright):** new specs `e2e/live-student.spec.ts` + `e2e/recording.spec.ts`. Tolerant of empty seed (skips if no live / recording session is visible to the student). Full chat + rate-limit + speed-change coverage lives in the manual plan §A + §B.
- **Verification gates (all green on `web-phase-1` 2026-05-28):**
  - `pnpm --filter @fynestudy/web typecheck` → 0 errors.
  - `pnpm --filter @fynestudy/web lint` → 0 errors, 0 warnings.
  - `pnpm --filter @fynestudy/web test` → 117/117.
  - `pnpm --filter @fynestudy/web build` → 29 routes (was 27 in Phase 3; +`/live/[sessionId]` +`/recording/[sessionId]`), sw.js generated.
  - `Get-ChildItem .next/static -Include *.js -Recurse | Select-String -Pattern 'SUPABASE_SERVICE_ROLE|service_role|sb_secret'` → zero matches.

### W-DEC entries (web decisions log) — Track 4A

- **W-DEC-4A.1:** Live + recording top-level routes live OUTSIDE `(protected)` (mirror of Phase-3 quiz/exam routes + mobile D-169). Each Client component wraps its own `<QueryProvider><SessionProvider>` (W-DEC-3.6 pattern) because the `(protected)` layout's providers are bypassed.
- **W-DEC-4A.2:** Separate `useLivePlaybackSign` (sessions) from `useYtPlayback` (library content). The two edge-fn invocations differ in key (`session_id` vs `content_id`) and in cache lifetime; reusing a single hook would force a confusing union type. 409 is surfaced via `status`, not `error`, so the lobby can keep retrying without showing a red message.
- **W-DEC-4A.3:** Chat posting is a DIRECT RLS insert (mobile D-191 mirror). The SECURITY DEFINER `chat_messages` BEFORE-INSERT trigger denormalizes `author_name` + `author_role` and enforces the 5-msgs-per-30s rate-limit. The web client MUST NOT send `author_name` — the trigger overwrites it. Errors come back via PostgREST and are surfaced inline in `ChatComposer`.
- **W-DEC-4A.4:** Reconnect-reload pattern: a `subscribedBefore` ref inside `useChatChannel` tracks the first vs subsequent SUBSCRIBED events. On the second+, the hook re-fetches history once because Realtime does NOT replay missed INSERTs (Phase-9 carry-over).
- **W-DEC-4A.5:** `WrappedYtPlayer` extended via `forwardRef` + `useImperativeHandle` exposing `play / pause / seekTo`. New optional props (`playbackRate`, `onPlayingChange`, `onDuration`, `onPosition`) are all additive — Phase-2 `VideoClient` continues to work unchanged. The recording screen uses **YouTube's native controls** (play/pause/seek) PLUS custom Speed 1× / 1.5× / 2× pills wired through `setPlaybackRate`. No custom transport bar like mobile (which existed only because WebView taps were unreliable on iOS Expo Go — not a web concern).
- **W-DEC-4A.6 (D-173 mirror):** No `controls=0` on the YouTube iframe — kept native YouTube controls visible on both live and recording. The play button serves as the autoplay gesture proxy.
- **W-DEC-4A.7:** Sessions table is NOT in the Realtime publication, so `useLiveSession` polls every 10s while `status='scheduled'`. Once `status='live'`, polling stops; the chat + bans channels become the only realtime subscriptions, plus the `endedSignal` (a `kind='system'` chat row) which triggers a manual session reload.
- **W-DEC-4A.8:** Realtime cleanup audit is now an automated Vitest source-scan (`realtimeCleanupAudit.test.ts`). The same parity is also a manual step in `phase-4-manual-tests.md §M.2`, but the source-scan is the authoritative guard against new hooks regressing the pattern.

### Carry-overs (after Track 4A)

1. Track 4B — the entire teacher portal (home, scan webcam QR, classes, content upload, quiz/exam builders + results + offline scores, batch analytics, roster, live-control). 11 build steps, 6 top-level routes, ~20 hooks, ~15 components, ~8 unit tests, ~6 E2E specs. Adds `@yudiel/react-qr-scanner` dep. Picks up §C–§L of the manual test plan.
2. Pinned-announcement (§A.9) + end-of-class (§A.10) full manual coverage depends on Track 4B's live-control. For Track 4A they're advanced SQL-simulated tests marked N/A.
3. Real OBS → unlisted-YouTube dry-run (§G) is Track 4B.
4. Vercel deploy + Supabase Auth redirect-URL allowlist + edge-fn CORS allow-list extension for `web-*.vercel.app` — Phase 5.
5. iOS Safari + Android Chrome on-device manual QA — needs HTTPS (Phase 5).
6. Component-level Jest tests for `LiveClient` / `RecordingClient` reducers / effects — Phase 5 hardening; Track 4A covers pure helpers + source-scans.

### Honored decisions from mobile (`docs/decisions.md`)

- **D-152** (teacher batch-scope on `app_users`) — preserved in `useRaiseHand.ts` teacher-queue join.
- **D-169** (top-level routes outside the tab group) — `live/[sessionId]` and `recording/[sessionId]` live outside `(protected)`.
- **D-173** (never `controls=0` on the YT iframe on mobile — the same UX argument applies on web for the autoplay gesture proxy) — preserved in `WrappedYtPlayer.tsx`.
- **D-190..D-196** (Phase-9 live decisions: chat is direct-RLS-insert with SECURITY DEFINER trigger, stream key never persisted, reconnect-reload, banned-cannot-raise-hand RLS, …) — preserved in the new hooks. The web hooks mirror the mobile hooks 1:1 with idiomatic web translations (no `withTimeout` since there's no Expo Go Keychain delay; no `AppState` since we have Page Visibility / `window.blur`; no `KeyboardAvoidingView` since CSS handles it).

### Status

- **Track 4A code-complete:** 2026-05-28 on branch `web-phase-1`.
- **Automated tests:** all green (117/117 unit, 0 errors typecheck + lint, build green, no service-role leak).
- **Manual QA:** pending — `Phases/phase-4-manual-tests.md §A + §B + §M + §N + §O + §P` ready for the user to walk through on Chrome desktop.
- **Track 4B:** picked up in the next conversation. Track 4B's session will append §C–§L to the manual plan and replace this `Track 4A closing` ledger with a full Phase-4-closing ledger.

⚠ **Do NOT mark Phase 4 as fully accepted until Track 4B is built AND the user finishes §P sign-off on the full manual plan.**
