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

## §J — Acceptance ledger (Phase 4 closing — 2026-05-28, code-complete pending manual QA)

### Code shipped (apps/web) — Track 4A + Track 4B

#### Track 4A (student-facing live + recording)

**New top-level routes (2)** — both outside the `(protected)` group so the side-rail / bottom-tabs don't render (W-23 / mobile D-169):
- `app/live/[sessionId]/page.tsx` + `_components/LiveClient.tsx` — wrapped YouTube player + Watermark + Lobby countdown (when scheduled) + realtime chat + raise-hand + own-ban + pinned-announcement + end-of-class detection. Responsive layout: split player|chat on desktop (≥ lg), stacked on narrow.
- `app/recording/[sessionId]/page.tsx` + `_components/RecordingClient.tsx` — wrapped player + Watermark + native YouTube controls + custom Speed 1× / 1.5× / 2× pills + time-synced ChatReplay (offset = `posted_at - started_at`).

**New live hooks (5)** + **1 utility** under `apps/web/features/`:
- `features/live/useLiveSession.ts` — single session row; polls every 10s while `status='scheduled'`.
- `features/live/useLivePlaybackSign.ts` — `yt-playback-sign` by `session_id + kind`. 409 surfaced via `status`.
- `features/live/useRaiseHand.ts` — `hands-{id}` channel; student raise/lower + teacher queue (D-152).
- `features/live/useSessionState.ts` — `ban-{id}-{uid}` channel; own-ban live state.
- `features/chat/useChatChannel.ts` — `chat-{id}` channel + history + Phase-9 reconnect-reload + direct RLS insert.
- `features/live/chat-replay.ts` — pure: `computeReplayOffsetSec`, `withReplayOffsets`, `messagesUpTo`, `countBetween`.

**New components (6)** under `apps/web/components/live/`: `LobbyCountdown`, `ChatPane`, `ChatComposer`, `RaiseHandButton`, `PinnedBanner`, `ChatReplay`.

**Extended**: `components/player/WrappedYtPlayer.tsx` → `forwardRef` + imperative `play/pause/seekTo` + optional `playbackRate / onPlayingChange / onDuration / onPosition` (additive).

**Discovery wiring**: `app/(protected)/classes/_components/StudentClasses.tsx` Live + Recorded segments link to `/live/{id}` + `/recording/{id}`.

#### Track 4B (teacher portal — full parity)

**New top-level routes (6)** — all FocusLayout outside `(protected)` (W-23 / D-169). Each Client component wraps its own `QueryProvider + SessionProvider`:
- `app/quiz-builder/[quizId]/{page.tsx, _components/QuizBuilderClient.tsx}` — scope picker (course→subject→chapter→topic + batch), title/duration/marks, atomic question-replace via direct RLS writes (D-172 deviation, see W-DEC-4B.6).
- `app/exam-builder/[examId]/{page.tsx, _components/ExamBuilderClient.tsx}` — title + batch + datetime-local + duration preset + Manual/Instant release + edit-after-publish warning + atomic question-replace (Phase-7 carry-over).
- `app/exam-results/[examId]/{page.tsx, _components/ExamResultsClient.tsx}` — roster + question analysis + release-results (with confirmation Dialog) + 3-mode regrade Dialog (full-recompute per D-179).
- `app/offline-scores/{page.tsx, _components/OfflineScoresClient.tsx}` — batch picker + subject + test name/date + max-score + roster-score grid (pre-fills existing silently per locked decision #3) + Save all via offline-score-upsert.
- `app/roster/[sessionId]/{page.tsx, _components/RosterClient.tsx}` — realtime `teacher-roster-{id}` channel + P/L/A pills + D-164 active-pill-toggles-to-unmark + CorrectionDialog preset reasons + bulk All-Present/All-Absent with confirm.
- `app/live-control/[sessionId]/{page.tsx, _components/LiveControlClient.tsx}` — Setup phase (broadcast-create + Copy buttons for server/key/both via `navigator.clipboard.writeText` + inline error card + Retry that keeps form state + Go Live) → Live phase (Stream tab = WrappedYtPlayer preview; Moderate tab = chat with DropdownMenu kebab moderation + raise-hand queue + Pin announcement composer) → End class via ConfirmDialog → `yt-broadcast-stop`. Stream key kept in `useState` only — NEVER cached.

**(teacher) tab routes (7)** — inside `(protected)` so the side-rail persists:
- `app/(protected)/page.tsx` — switches on `active_role`. Teacher branch renders `_components/TeacherDashboard.tsx` (Next card + Pending list + Today + Quick actions + My batches).
- `app/(protected)/scan/page.tsx` + `_components/ScanClient.tsx` — webcam scan, gated on Start camera button (iOS Safari gesture safety), Reset camera button, session dropdown, permission-denied → roster fallback link.
- `app/(protected)/classes/_components/TeacherClasses.tsx` — Today/Upcoming/Past segmented + Schedule-Live FAB + Ad-hoc FAB + per-row Scan/Roster/Live-control chips.
- `app/(protected)/content/{page.tsx, _components/TeacherUploadClient.tsx}` — Kind toggle (Video URL vs PDF) + CurriculumPicker + Scope (My Batch vs Suggest course-wide) + Title/Description + `<input type="file">` → presign → XHR PUT with progress 0-100% → finalize.
- `app/(protected)/quizzes/{page.tsx, _components/TeacherQuizzesClient.tsx}` — list view, +New routes to `/quiz-builder/new`.
- `app/(protected)/exams/{page.tsx, _components/TeacherExamsClient.tsx}` — list view, +New + Offline scores nav button.
- `app/(protected)/batch/{page.tsx, _components/TeacherBatchListClient.tsx}` + `app/(protected)/batch/[id]/{page.tsx, _components/TeacherBatchOverviewClient.tsx}` — list assigned batches → analytics tabs Risk / Mastery / Attendance (inside `(protected)` per locked decision #2).

**New teacher hooks (16)** under `apps/web/features/teacher/`:
- Reads: `useTeacherDashboard` (RPC + on-focus invalidate), `useTeacherBatchOverview` (RPC), `useAssignedBatches`, `useTeacherSessions` (+ `pickNearestSession` + buckets), `useTeacherCurriculum`, `useTeacherBatches`, `useBatchSubjects`, `useTeacherQuizzes`, `useTeacherQuizBuilder`, `useQuestionBank`, `useTeacherExams`, `useTeacherExamBuilder`, `useExamResultsBoard`, `useOfflineScores`, `useRoster`, `useSessionBans`.
- Pure helpers: `scan-toast-mapper.ts` (HTTP status → ScanToast), `roster-pill-state.ts` (D-164 transitions), `builder-question-replace.ts` (atomic upsert+delete plans + reorder), `offline-score-validation.ts` (zod schema + entry filter), `raise-hand-queue.ts` (FIFO + dedup).
- `mutations.ts` collects every teacher edge-fn write: `useAttendanceCorrect/ManualMark/Unmark/BulkMark`, `useCreateAdHocSession`, `useYtBroadcastCreate/GoLive/Stop`, `useChatDelete`, `useChatBan`, `useOfflineScoreUpsert`, `useExamRelease`, `useExamRegrade`, `useContentCreateVideo/PresignUpload/Finalize`, `useQuizImagePresign`, `putBlobWithProgress` (XHR helper with onprogress). All call `invokeEdgeFn` so the real HTTP status reaches the call site.

**New teacher components (12)** under `apps/web/components/teacher/`: `ScannerOverlay` (corner brackets + tone), `WebcamScanner` (lazy `next/dynamic({ ssr:false })` wrapper for `@yudiel/react-qr-scanner`, gated on `active`), `PendingList`, `AtRiskList`, `BatchHeatmap`, `TopicMasteryBars`, `RosterRow` (P/L/A pills + Edit button), `CorrectionDialog`, `SessionCreateSheet` (combined Schedule-Live / Ad-hoc), `CurriculumPicker` (cascading native `<select>`s), `QuestionBankSheet` (multi-select + search), `ConfirmDialog`, `ChatModerationMenu` (Radix DropdownMenu kebab), `ExamRegradeDialog` (3-mode + new-correct picker + reason).

**Middleware update**: `middleware.ts` teacher-only path list gained `/quiz-builder`, `/exam-builder`, `/exam-results`, `/offline-scores`, `/roster`, `/live-control`. `/live/[id]` + `/recording/[id]` intentionally stay open to BOTH roles.

**Dependency added**: `@yudiel/react-qr-scanner` (lazy-loaded; not in initial /scan bundle).

### Tests

- **Unit (Vitest):** 196/196 pass across 24 files (was 117/117 across 17 in Track 4A).
  - Track 4A: `features/live/__tests__/{chat-replay,realtimeCleanupAudit}.test.ts` (14 + 34 — the audit auto-grew from 11 → 34 as Track-4B added more files).
  - Track 4B: `features/teacher/__tests__/scanToastMapper.test.ts` (15), `rosterCorrectionState.test.ts` (9), `builderQuestionReplace.test.ts` (12), `offlineScoreValidation.test.ts` (12), `raiseHandQueue.test.ts` (5), `cameraGesture.test.ts` (5 source-scan), `streamKeyNoCache.test.ts` (2 source-scan).
- **E2E (Playwright):** Track 4A `live-student.spec.ts` + `recording.spec.ts`; Track 4B adds `teacher-scan.spec.ts`, `teacher-classes.spec.ts`, `teacher-builders.spec.ts`, `teacher-results.spec.ts`, `live-control.spec.ts`, `teacher-roster.spec.ts`, `teacher-content.spec.ts`. All seed-tolerant (skip when no live session / no exams).
- **Verification gates (all green on `web-phase-1` 2026-05-28):**
  - `pnpm --filter @fynestudy/web typecheck` → 0 errors.
  - `pnpm --filter @fynestudy/web lint` → 0 errors, 0 warnings.
  - `pnpm --filter @fynestudy/web test` → 196/196.
  - `pnpm --filter @fynestudy/web build` → **36 routes** (up from 29). All 6 top-level teacher routes present; sw.js generated.
  - `Get-ChildItem .next/static -Include *.js -Recurse | Select-String -Pattern 'SUPABASE_SERVICE_ROLE|service_role|sb_secret'` → **0 matches**.

### W-DEC entries (web decisions log) — Phase 4 closing

**Track 4A** (unchanged from previous ledger):
- **W-DEC-4A.1..W-DEC-4A.8** — see prior closing notes (live + recording routes outside `(protected)`, `useLivePlaybackSign` split from `useYtPlayback`, chat-as-direct-insert, reconnect-reload pattern, `WrappedYtPlayer` forwardRef, no `controls=0`, sessions-not-in-Realtime → polling, automated realtime audit).

**Track 4B**:
- **W-DEC-4B.1:** Six teacher top-level FocusLayout routes live OUTSIDE `(protected)`: `quiz-builder/[quizId]`, `exam-builder/[examId]`, `exam-results/[examId]`, `offline-scores`, `roster/[sessionId]`, `live-control/[sessionId]`. Each Client component wraps its own `QueryProvider + SessionProvider` (W-DEC-3.6 pattern). Batch analytics is intentionally KEPT inside `(protected)` (locked decision #2) so the teacher's side-rail stays visible during data review.
- **W-DEC-4B.2 (webcam gesture safety):** `WebcamScanner` is lazy-loaded via `next/dynamic({ ssr: false })` AND gated on a parent-controlled `active` boolean. The scanner does NOT mount (and thus does NOT call `getUserMedia`) until the user presses "Start camera". iOS Safari rejects camera requests that fire on mount. Asserted by source-scan in `cameraGesture.test.ts`.
- **W-DEC-4B.3 (decoder debounce + dedup):** `useScanVerify` runs a 500ms debounce + same-token suppression (1500ms) inside the hook BEFORE calling `attendance-qr-verify`. The decoder fires up to ~camera-FPS; without this dedup the server's 2 verifies/sec/teacher rate-limit would also trip on the second device-frame of the same QR.
- **W-DEC-4B.4 (Reset camera):** A "Reset camera" button bumps `resetKey`, which re-mounts the `<WebcamScanner key="scanner-N">`. iOS Safari sometimes freezes the camera after backgrounding; this is the cheapest recovery without forcing a hard reload.
- **W-DEC-4B.5 (Stream key NEVER persisted):** The YouTube stream key lives ONLY in `LiveControlClient` component-local `useState`. It is NOT cached in React Query, NOT in localStorage, NOT in sessionStorage. Asserted by a source-scan in `streamKeyNoCache.test.ts` that fails if any new file references `stream_key` outside the allow-list (`mutations.ts` for the typed request shape + `LiveControlClient.tsx` for the live render).
- **W-DEC-4B.6 (D-172 audit — partial coverage, deliberate deviation from the kickoff prompt):** `quiz-admin-mutate` and `exam-admin-mutate` REJECT non-admin callers (confirmed via `apps/functions/quiz-admin-mutate/index.ts:36` and `apps/functions/exam-admin-mutate/index.ts:38` — `if (!isAdmin(caller.roles)) return 403;`). The Track 4B kickoff prompt said "all writes through `quiz-admin-mutate`" but that would 403 every teacher write. We mirror the mobile teacher precedent: builder writes (`quizzes`, `quiz_questions`, `exams`, `exam_questions`) go through direct RLS-protected PostgREST writes. Every OTHER teacher mutation (attendance correct/manual/unmark/bulk, exam-release, exam-regrade, offline-score-upsert, content-create-video / presign / finalize, session-create-ad-hoc, yt-broadcast create/golive/stop, chat-delete, chat-ban) goes through an edge fn so `audit_log` captures before/after. Net result: D-172 audit coverage is identical to mobile (everything but the builder PostgREST writes). §M.3a in the manual plan verifies the audit rows land.
- **W-DEC-4B.7 (atomic question replace — Phase-7 carry-over):** The exam + quiz builders REPLACE the question set with `upsert(onConflict='X_id,question_id')` FIRST, THEN delete rows outside the desired set. A delete-then-insert leaves a published exam empty if the insert fails mid-stream; the upsert-then-delete order means the worst-case failure leaves at most a superset (never empty). Pure helper at `features/teacher/builder-question-replace.ts`; covered by 12 vitest assertions.
- **W-DEC-4B.8 (D-164 mirror):** The roster screen's `nextRosterAction` pure helper encodes mobile D-164: tap the active pill → unmark (with a confirm Dialog); tap a different pill while marked → correction (with a Dialog); tap any pill while unmarked → manual-mark immediately. Centralised in `roster-pill-state.ts` so a future UI rewrite can't accidentally break the active-pill-toggle behavior.
- **W-DEC-4B.9 (live-control: two tabs, one player):** The Live phase uses Radix Tabs (Stream / Moderate) — only one tab renders at a time, so we never have two YouTube iframes mounted in the same view (preserves the "one player per view" performance rule, mobile D-173 surface).
- **W-DEC-4B.10 (clipboard copy):** `navigator.clipboard.writeText` for RTMP server + stream key. Brief "Copied" affordance for 1.6s. Insecure-context errors are swallowed because they only happen on `http://lan-ip` deploys (we're localhost / Vercel HTTPS in practice).

### Honored decisions from mobile (`docs/decisions.md`)

- **D-152** (teacher batch-scope on `app_users`) — preserved in `useRaiseHand.ts`, `useRoster.ts` student-name embeds, `useExamResultsBoard.ts` roster join, `useOfflineScores.ts` roster join.
- **D-157 / D-169** (top-level routes outside the tab group) — `live`, `recording` (Track 4A) + `quiz-builder`, `exam-builder`, `exam-results`, `offline-scores`, `roster`, `live-control` (Track 4B) all outside `(protected)`. Batch analytics intentionally KEPT inside `(protected)` per the user-confirmed locked decision.
- **D-164** (tap active pill → unmark) — encoded in `roster-pill-state.ts` + tested.
- **D-172** (admin server-action audit) — see W-DEC-4B.6 above for the deviation rationale. Mobile teacher writes don't audit-cover builder PostgREST either; web parity is identical.
- **D-173** (no `controls=0` on YT iframe) — preserved in `WrappedYtPlayer.tsx`.
- **D-179** (full-recompute regrade) — Track 4B exam-regrade flow surfaces "N attempt(s) recomputed" inline after the edge fn returns.
- **D-181** (instant exam re-open routing) — already preserved by Phase-3 student exam screen.
- **D-190..D-196** (Phase-9 live decisions) — chat as direct RLS insert with SECURITY DEFINER trigger, stream key never persisted, reconnect-reload, banned-cannot-raise-hand RLS, all preserved in Track 4A; Track 4B's live-control reuses the same hooks.

### Carry-overs (after Phase 4)

1. Vercel deploy + Supabase Auth redirect-URL allowlist + edge-fn CORS allow-list extension for `web-*.vercel.app` — Phase 5.
2. iOS Safari + Android Chrome on-device manual QA — needs HTTPS (Phase 5).
3. Component-level Jest tests for `LiveClient` / `RecordingClient` / `LiveControlClient` reducers/effects — Phase 5 hardening (Phase 4 covers pure helpers + source-scans).
4. Sentry + PostHog — Phase 5 mirror of mobile's deferred-since-Phase-1 plan.
5. Real OBS dry-run on the **client's** YouTube channel (not the dev's NOvA FX) — happens when the production-mode hand-off lands.

### Status

- **Phase 4 code-complete:** 2026-05-28 on branch `web-phase-1`.
- **Automated tests:** all green (196/196 unit, 0 typecheck/lint errors, build green at 36 routes, no service-role-key leak).
- **Manual QA:** pending — `Phases/phase-4-manual-tests.md §A–§L + §M + §N + §O + §P` ready for the user on Chrome desktop. Real OBS dry-run lives in §G.
- **Web app is now at full feature parity with the mobile app.** Phase 5 is hardening + Vercel deploy + on-device QA + Sentry/PostHog — no new feature surface.

⚠ **Do NOT mark Phase 4 as fully accepted until the user signs off the FULL manual plan (§P).**
