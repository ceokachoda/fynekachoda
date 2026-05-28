# Phase 2 — Student Learning Surfaces

> **Prerequisite:** Phase 1 accepted (shell + auth + design system live). This phase makes the **student experience real** for everything *except* assessments (Phase 3) and live classes (Phase 4): dashboard, profile/mastery/badges, leaderboard, attendance, library, video player, PDF reader.

---

## Goal / Definition of Done

A logged-in **student** can, on laptop + iOS + Android web:

1. See a **dashboard** with greeting, next-up card, stats (attendance %, mastery %, rank), today's schedule, weak topics, continue-watching, recent badges — with the badge-earned celebration + streak modals.
2. Open **Profile** → Profile / Mastery / Badges tabs; change password; view the badge showcase.
3. Open **Ranks** (leaderboard) → Weekly / All-time, see own rank card, tap a row for the public card, read the calc explainer.
4. Open **Attendance** → see a live 30-second rotating **QR to show the teacher**, today's sessions, and history rings; the screen updates in realtime when marked.
5. Browse the **Library** (Subject→Chapter→Topic→Item) with search.
6. **Watch a video** (YouTube wrapped, watermarked, resume) and **read a PDF** (watermarked, page-resume).

---

## Prerequisites
- Phase 1 acceptance ticked.
- Seed data: a student with attendance history, mastery rows, a streak, ≥1 earned + ≥1 unseen badge, a populated curriculum with ≥1 video + ≥1 PDF, and a leaderboard with the student ranked. Use `pnpm seed:dashboard-manual-test --reset` / `seed:leaderboard-manual-test` / `seed:content-manual-test` (mobile seeds already exist; they seed the same backend).

---

## Scope

### Screens
| Web route | Mirrors mobile | Tier |
|---|---|---|
| `(student)/` (home) | `(student)/index.tsx` | Complex (composition) |
| `(student)/profile` | `(student)/profile.tsx` | Simple (3 tabs) |
| `(student)/leaderboard` | `(student)/leaderboard.tsx` | Simple |
| `(student)/attendance` | `(student)/attendance.tsx` | Complex (QR rotation + realtime) |
| `(student)/library` | `(student)/library.tsx` | Complex (drill-down + search) |
| `(student)/menu` | `(student)/menu.tsx` | Simple |
| `(student)/classes` (shell) | `(student)/classes.tsx` | Segmented control + Upcoming list; Live/Recorded/Exams sections placeholder (filled in P3/P4) |
| `video/[contentId]` | `app/video/[contentId].tsx` | Complex (player) |
| `pdf/[contentId]` | `app/pdf/[contentId].tsx` | Complex (pdf.js) |
| streak modal | `app/modal.tsx` | Simple (dialog) |

### Components (port from `apps/mobile/components/`)
- **dashboard/**: `NextCard`, `StatsStrip`, `TodayScheduleStrip`, `WeakTopicsList`, `ContinueStrip`, `StreakFlame`, `MasteryCard`, `RecentBadgesStrip`.
- **leaderboard/**: `RankRow`, `RankBadge`, `ScopeTabs`, `LeaderboardCalcModal`.
- **gamification/**: `BadgeIcon`, `BadgeShowcase`, `BadgeEarnedModal` (confetti).
- **attendance/**: `QrDisplay` (now `qrcode.react`), `AttendanceRing`, `AttendanceHistory`.
- **live/**: `Watermark`, `PdfWatermark`, **`WrappedYtPlayer` (web, `react-youtube`)**.
- Streak calendar (from `modal.tsx`) → a `StreakModal` dialog.

### Hooks ported (→ TanStack Query)
`useStudentDashboard` (RPC `student_dashboard`), `useStudentSchedule`, `useMastery`, `useStreak`, `useLeaderboard` (RPC `my_batch_leaderboard`) + `fetchStudentCard` (RPC `student_public_card`), `useBadgesCollection` + `useUnseenBadges` (+ `badge-icon-sign`), `useAttendanceHistory`, `useTodaySessions`, `useQrToken` (`attendance-qr-sign`), `useAttendanceRealtime`, `useMyBatch`, `useLibraryTree`, `useContentItem`, `useVideoProgress`, `usePdfProgress`, `usePlaybackSign` (`yt-playback-sign`).

### Edge fns / RPC / realtime
- Edge: `attendance-qr-sign`, `badge-icon-sign`, `yt-playback-sign`, `content-pdf-sign`.
- RPC: `student_dashboard`, `my_batch_leaderboard`, `student_public_card`.
- Realtime: `student-attendance-{id}` (mark/correct).
- Tables (RLS reads/writes): `attendance`, `sessions`, `mastery`, `streaks`, `activity_days`, `badges`, `badge_earnings`, `content_items`, `video_progress`, `pdf_progress`, `students`, `batches`, `courses`, `subjects`, `chapters`, `topics`.

---

## Step-by-step build order

### A. Port the data layer to TanStack Query
1. For each hook above, create `apps/web/features/<area>/<hook>.ts`. Pattern: copy the mobile hook's query/RPC/edge-fn body verbatim, wrap the fetch in `useQuery({ queryKey: [...], queryFn })`, keep mutations in `useMutation`. Reuse the **same** `supabase.from(...)`/`.rpc(...)` calls and the ported `lib/edge-fn.ts`.
2. Realtime (`useAttendanceRealtime`): subscribe in a `useEffect`; on event, `queryClient.invalidateQueries(['attendance', studentId])`; `removeChannel` on cleanup (W-22).
3. Throttled progress writes: `useVideoProgress` (10s throttle, `video_progress` upsert) and `usePdfProgress` (5s throttle, `pdf_progress` upsert) — keep the mobile throttle values; use a `useRef` debounce.

### B. Dashboard (`(student)/`)
4. Server Component fetches nothing heavy (auth only); Client Component `StudentHome` composes the dashboard hooks. Layout: on desktop a **2-column grid** (left: NextCard + StatsStrip + TodaySchedule; right: WeakTopics + ContinueStrip + RecentBadges); on mobile a single column matching the mobile order.
5. Build the 8 dashboard components 1:1 (open each `apps/mobile/components/dashboard/*` for exact styling — colors, radii, the blue-600 NextCard, the amber weak-topic circles, the streak flame tiers).
6. `BadgeEarnedModal`: poll `useUnseenBadges` on focus; show confetti modal per unseen badge; `dismiss()` flips `is_seen`. **Carry over the mobile fix** (memory `project-phase-9-10-qa-hardening`): guard against double-celebration race + re-fire confetti per badge. Use a CSS/canvas confetti (e.g., `canvas-confetti`).
7. Streak: clicking the streak flame opens `StreakModal` (30-day heatmap, flame color by intensity, badges earned during the streak) ← `app/modal.tsx`. On web this is a `Dialog`, not a route (or a parallel route — Dialog is simpler).
8. NextCard routing: "live class / upcoming session" → `/live/[id]` or `/classes` (Phase 4); until Phase 4, route to `/classes`. Exam next-card → `/exam/[id]` (Phase 3) — gate with a "coming soon" toast until that phase lands, or leave the route 404-safe.

### C. Profile + Menu
9. `(student)/profile`: shadcn `Tabs` = Profile / Mastery / Badges. Profile tab shows read-only identity (full_name, email, phone, dob, batch, course — **no edit inputs**, per D-016) + "Contact admin to change" + a **Change password** dialog (calls `auth-change-own-password`). Mastery tab = `useMastery` list of `MasteryCard`. Badges tab = `BadgeShowcase`.
10. `(student)/menu`: settings list (General / Security / About) with placeholders + Sign out (already in profile menu; keep here too for parity).

### D. Leaderboard (`(student)/leaderboard`)
11. `ScopeTabs` (Weekly / All-time) → `useLeaderboard(scope)`. Render `RankRow` list with `RankBadge` (🥇🥈🥉 / #N); highlight `is_me`. Sticky "my rank" card. Tap row → `Dialog` with `student_public_card`. Info "i" → `LeaderboardCalcModal` (0.60 Q + 0.25 A + 0.15 S). **Carry over** the public-card crash guard (memory hardening note).

### E. Attendance (`(student)/attendance`)
12. `QrDisplay` using `qrcode.react`: `useQrToken` calls `attendance-qr-sign` for the open session; render the `payload_b64` as a QR, rotate every 30s (refresh at 25s), show a 1s countdown ring. States: loading / token / marked / error / no-open-window.
13. `useTodaySessions` (IST day boundary, ±15min scan window) → list with status; `useAttendanceHistory` → week/30-day `AttendanceRing`s + recent `AttendanceHistory` list.
14. `useAttendanceRealtime`: when the teacher scans, the row flips to "present/late" live (invalidate query). Verify cleanup.

### E2. Classes tab shell (incremental — filled across P3/P4)
14a. `(student)/classes`: build the route + `Segmented` control with **Live · Upcoming · Recorded** + an Exams section below. Wire the **Upcoming** segment now via `useStudentSchedule` (sessions in the next 14 days with subject, time, batch). **Live** and **Recorded** segments render `<EmptyState>` placeholders ("Live classes arrive in Phase 4" / "Recordings arrive in Phase 4") — replaced by `useLiveSession` lists in Phase 4. The **Exams** section renders an `<EmptyState>` placeholder ("Coming with assessments in Phase 3") — replaced by `useStudentExams` in Phase 3. This avoids the navbar pointing at a broken tab in P2.

### F. Library + players
15. `(student)/library`: `useLibraryTree` builds Subject→Chapter→Topic→Item; implement drill-down with breadcrumb + back, plus a search box filtering across the tree (mirror mobile's per-view list behavior). Items route to `/video/[id]`, `/pdf/[id]`, or external note links; per-topic quizzes link to `/quiz/[id]` (Phase 3).
16. **Video** (`video/[contentId]`, `FocusLayout`): `useContentItem` + `usePlaybackSign(kind:'recording'|'library')` → `video_id`; render `WrappedYtPlayer` (web) = `react-youtube` with the `Watermark` overlay (rotating position every 60s). **Resume sheet** if `video_progress` ≥ 10s. Save progress every 10s. **Never set `controls=0`** (D-173 still applies — keep native YT controls). Only one player mounted; unmount on navigate.
17. **PDF** (`pdf/[contentId]`, `FocusLayout`): `content-pdf-sign` → signed URL; render with `react-pdf` (`<Document><Page/></Document>`), continuous scroll, page tracking → `usePdfProgress` (resume to last page). Overlay `PdfWatermark` (the 3×4 rotated grid) absolutely positioned. **Note (W-20):** screen-capture can't be blocked on web — the watermark is the deterrent; do not attempt `expo-screen-capture`. D-174's pinch-zoom WebView hack is **not** needed (browser handles zoom natively).

### G. Responsive polish
18. Every list uses a sensible desktop layout (cards in a grid where the mobile used a single column — e.g., library items, badge grid stays 3-up, leaderboard stays a single readable column with max-width). Hover states on rows/cards; focus rings for keyboard.

---

## Gotchas / carried-over decisions
- **Only one media player mounted at a time**; unmount on blur/navigate (performance rule). The PDF and video are full-screen `FocusLayout` routes so the rail/tabs aren't competing.
- **`yt-playback-sign` returns the `video_id` only to authorized users** — never hardcode/expose IDs; handle its 409 (not ready) gracefully.
- **Throttle the progress upserts** (10s video / 5s pdf) — don't write on every tick.
- **`useFocusEffect` object-dep loop** (mobile lesson, memory `feedback_focuseffect-object-dep`): the web equivalent is unstable `useEffect`/`useQuery` deps — destructure stable `refetch` fns; don't put whole hook-result objects in dep arrays.
- **Badge confetti**: re-fire per unseen badge + guard double-celebration (carried Phase-10 fix).
- **IST day boundaries** for "today's schedule"/attendance windows — reuse the mobile date math (don't use the browser's local tz directly).

## Automated tests
- Unit: library tree builder, QR rotation timer, progress-throttle, leaderboard row mapping, mastery color thresholds. (`apps/web/features/**/*.test.ts`.)
- E2E (Playwright): dashboard renders all sections for the seed student; profile tabs switch; leaderboard scope toggle + public-card dialog; attendance QR appears + rotates; library drill-down opens a video and a PDF.
- Network assertion: confirm no PII beyond own rows is fetched (spot-check via RLS).

## Manual test checklist (Chrome desktop + iOS Safari + Android Chrome)
1. Dashboard shows correct stats, today's schedule, weak topics, continue-watching, recent badges; an **unseen badge** triggers the celebration modal once; dismiss persists.
2. Tap streak flame → 30-day heatmap modal with correct intensities + streak badges.
3. Profile: identity is read-only (no edit fields); Mastery + Badges tabs populate; Change password works and is enforced on next login.
4. Leaderboard: Weekly/All-time toggle; my-rank highlighted; tap a peer → public card; calc modal text correct.
5. Attendance: QR renders + rotates every 30s; have a teacher scan it (or simulate) → row flips to present **live**; history rings correct.
6. Library: drill Subject→Chapter→Topic→Item; search filters; open a **video** (plays, watermark visible, resume works, native controls present) and a **PDF** (renders, watermark visible, resumes to last page, scroll + zoom work).
7. Resize 320px↔1440px: dashboard goes 1-col↔2-col; players stay usable; no overflow.

## Acceptance criteria
- [x] All 6 student tabs (minus assessments) + video + pdf + streak modal work and match the mobile design.
- [x] Realtime attendance update works (via Postgres CDC channel `student-attendance-{id}-{rand}`); QR rotates every 25s and rotates the token via `attendance-qr-sign`.
- [x] Video resume + watermark; PDF resume + watermark; only one player mounted; clean unmount via dynamic ssr:false imports.
- [x] Badge celebration + streak modal behave (lazy-loaded `canvas-confetti`, dismiss writes `seen_at`, public-card dialog has the same-batch crash guard from Phase-10 D-202).
- [x] Typecheck/lint/test/build green (41 unit tests, build emits 25 routes including `/video/[contentId]` + `/pdf/[contentId]`); Playwright E2E spec files in place; manual checklist (Chrome desktop) PENDING on-device sign-off.

## §J — Acceptance ledger (Phase 2 code-complete — 2026-05-28)

- **Code:** ~76 new files across `apps/web/{features,components,lib,types,e2e}` + 9 new routes (`/`, `/profile`, `/leaderboard`, `/attendance`, `/classes`, `/library`, `/menu`, `/video/[contentId]`, `/pdf/[contentId]`). Replaces the Phase 1 placeholder welcome card with a real `StudentDashboard` (NextCard + StatsStrip + TodayScheduleStrip + WeakTopicsList + ContinueStrip + RecentBadgesStrip + StreakFlame + BadgeEarnedModal + StreakModal) wired to the `student_dashboard` RPC. Profile is a 3-tab segmented control (Profile/Mastery/Badges) with identity strictly read-only per D-016 and the change-password dialog routing through `auth-change-own-password` per D-153. Leaderboard uses `my_batch_leaderboard` + `student_public_card` RPCs with the same-batch crash guard. Attendance shows a rotating QR via `attendance-qr-sign` (25s refetch, 30s server TTL) + history rings + realtime channel cleanup. Library is URL-state drill-down (`?subject=...&chapter=...&topic=...&q=...`). Video player is `react-youtube` dynamic({ssr:false}) with CSS-animated 5-position watermark and 10s leading-edge throttle on `video_progress`. PDF viewer is `react-pdf` dynamic({ssr:false}) with bundled pdfjs worker (via `new URL(..., import.meta.url)`), tiled diagonal watermark, IntersectionObserver-based page tracking, and 5s throttle on `pdf_progress`.
- **Hooks:** 21 TanStack Query hooks under `apps/web/features/{dashboard,gamification,leaderboard,attendance,library,quiz,exams,org,profile}/use*.ts`. All gated by `useSession().appUser?.id`. Direct table reads where RLS already protects; edge fns for signed URLs + mutations.
- **Tests:** `pnpm test` → **41 / 41 passed** (8 test files: ist, watermark, role-helpers, edge-fn, masteryColor, computeStatus, scanWindow, useLibraryTree). New Phase 2 E2E specs in `e2e/`: dashboard, profile, leaderboard, attendance, library, security. Phase 1's auth.spec.ts updated to use `data-testid="student-dashboard"` / `teacher-home` instead of the deleted welcome card.
- **Gates:** `typecheck` 0 errors · `lint` 0 errors / 0 warnings · `build` 25 routes, sw.js generated, no `Attempted import error` warnings. Static-bundle grep for `SUPABASE_SERVICE_ROLE` + `service_role`: 0 matches.
- **Deps added:** `react-pdf@^9.2.1`, `pdfjs-dist@^4.10.38`, `react-youtube@^10.1.0`, `use-debounce@^10.0.4`, `canvas-confetti@^1.9.3`, `@types/canvas-confetti@^1.9.0`.
- **CSP extended:** added `frame-src https://www.youtube.com https://www.youtube-nocookie.com`, `worker-src 'self' blob:`, `connect-src ... https://www.youtube.com`, and explicit `compiler.removeConsole` for prod builds.
- **Decisions honoured:** D-016 (identity read-only), D-061 (watermark on PDF), D-070 (rolling-N mastery surfaced via dashboard RPC), D-153 (`auth-change-own-password` — never `supabase.auth.updateUser`), D-171 (signed PDF URL via `content-pdf-sign`), D-172 (privileged writes via edge fn), D-173 (NO `controls=0` on YouTube IFrame), D-174 (web browsers handle pinch-zoom natively), D-186 (dashboard + leaderboard RPCs are SECURITY DEFINER + own-or-admin), D-200 (placeholder badge SVGs, `BadgeIcon` falls back to lucide Award if URL missing), D-202 (`student_public_card` null → "Card unavailable" UI).
- **Carry-overs to Phase 5 (Hardening / Launch):**
  - iOS Safari + Android Chrome PWA install (needs HTTPS — Vercel deploy session).
  - Multi-role + suspended account flows (accounts never created — same as Phase 1).
  - Sentry + PostHog wiring (deferred at user direction).
  - Live class playback + chat + raise-hand (Phase 4).
  - Quiz / exam attempts (Phase 3).
  - Note rendering with KaTeX (Phase 3+).
  - Webcam QR scanner for teachers (Phase 4 — student-side QR display lands here).
- **Manual QA signed off:** PENDING — see `Phases/phase-2-manual-tests.md` (Chrome desktop only; iOS / Android = carry-over).
