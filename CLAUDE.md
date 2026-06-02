Everytime you code, don't just guess. Be precise; if in doubt, ask. Test everything (incl. Supabase backend) and make it perfect.

# FyneStudy — Coaching OS

> Hybrid coaching institute OS for JEE/NEET/CUET prep. One mobile app (students + teachers, role-gated), one web app (same, PWA), one web admin panel, one Supabase backend (`orqwyazvcthgxoadfxfv`, `ap-south-1`). Live classes via wrapped YouTube. Attendance via rotating QR. Practice quizzes + graded exams.

> **Per-phase detail (migrations, edge fns, decision IDs, test counts, file lists) lives in `docs/phases/phase-N.md §14/§15`, `docs/decisions.md`, `docs/file-structure.md`, and auto-memory — NOT here.** This file is orientation + binding rules. Keep it terse; push new detail to those docs.

## Mobile + backend phase status
Full detail in `docs/phases/phase-N.md`. Decisions in `docs/decisions.md`.

| Phase | Status | Delivered |
|---|---|---|
| P0 | ✅ | UI scaffolding (dead OTP/verify/select-course screens deleted in P2) |
| P1 | ✅ 05-14 | pnpm monorepo, Supabase, `health` fn, Vercel admin, CI, EAS (PR#1 `bea08b2`) |
| P2 | ✅ 05-15 | Identity tables + RLS (`private` schema), auth bootstrap/suspend/force-reset, admin login+TOTP+students CRUD, mobile force-pw-change + role gates |
| P3 | ✅ 05-15 | Courses/batches, MFA recovery codes, admin /courses /batches /teachers /2fa, mobile profile + teacher batches |
| P4 | ✅ 05-18 | Attendance: rotating QR sign/verify/correct, sessions, teacher scan + roster, admin matrix+CSV |
| P5 | ✅ 05-19 | Content library: video (wrapped YT) + PDF (WebView+pdf.js), presign upload, watermark, admin /content |
| P6 | 🟡 QA PENDING | Practice quizzes: 4-stage attempt, MathText/KaTeX, builder, admin. **Do NOT mark done until QA signs off `phase-6-manual-tests.md`** |
| P7 | ✅ 05-21 | Server-timed graded exams: locked UI, tab-switch log, regrade-with-audit, offline scores |
| P8 | 🟡 QA PENDING | Mastery + streaks + dashboards (mobile+backend only, NO admin). Data layer re-verified; only visual/on-device QA left. **Do NOT mark done until QA signs off** |
| P9 | ✅ 05-27 | Live classes (YouTube wrap) + chat + raise-hand + moderation. YT provisioned on dev TEMP "NOvA FX" channel `UCSa8awrJseI_8r_oZQjuvYQ` |
| P10 | ✅ 05-27 | Batch leaderboard (0.60Q+0.25A+0.15S, D-071) + 11 badges + streak flame (badge SVGs are placeholders) |
| P11 | ⏭️ SKIPPED (D-203) | Parents' WhatsApp report cut. Drops Gupshup; `students.parent_phone` collected-but-unused |
| P12 | 🟡 CODE-COMPLETE | Final: admin Overview/audit/admins/import; mobile build-blocker fix (`eas.json` embeds env). Existing dev DB IS prod; Sentry/PostHog deferred. Pending (user): Play Console + `eas build` + on-device QA |

**Staged-not-deployed:** 3 LOW-sev P9/P10 edge-fn guards staged for a P12 deploy — see `phase-9.md §15.11`.

## Web app (`apps/web` — 4th surface, students + teachers PWA)
Separate Next.js 15 + Tailwind 4 + shadcn 4.7 + `@supabase/ssr` cookie auth + TanStack Query + serwist PWA. Phase docs in root `Phases/` (start `Phases/00-overview-and-architecture.md`; decisions W-01..W-23). Same hard rules as mobile (anon key only, privileged via edge fns, server-auth exam timer + QR, no `is_correct`/stream keys, private buckets via signed URLs, realtime cleanup on unmount). Web equivalents (W-11..W-16): QR scan `@yudiel/react-qr-scanner`, QR display `qrcode.react`, video `react-youtube`, PDF `react-pdf`, math `katex`+`react-katex`. Screenshot-prevent not enforceable on web (W-20) — watermark only.

| Phase | Status | Delivered |
|---|---|---|
| WP1 | ✅ code-complete | Foundation: Next 15 + middleware role gating + PWA + 15 Fyne primitives |
| WP2 | ✅ code-complete | Student surfaces: dashboard, profile, leaderboard, attendance QR, library, video, PDF |
| WP3 | ✅ code-complete | Quiz (4-stage) + exam (5-stage locked), KaTeX MathText, server-anchored timer, tab-switch |
| WP4 | ✅ code-complete | Live + recordings + full teacher portal (scan, classes, builders, results, roster, live-control). **Full mobile parity.** Polished UI/UX 05-29 |
| WP5 | 🟢 code+backend complete | Hardening, a11y/perf/SEO/PWA, D-204 cross-surface exam answer-key fix. **Backend already deployed** (52 fns CORS + web origin, migration, redirect URLs — don't redo). ⚠ Vercel project MUST be named `fyne-study-web`. Pending (user): Vercel deploy + §A–§J QA |

Custom domain `fynestudy.live` is live (CORS + Supabase Auth URLs whitelisted). Deploy guide `docs/web-app-deploy.md`; noob test guide `docs/web-app-test-checklist.md`.

## Launch
🚀 `START-HERE.md` (root) → `docs/play-store-upload-guide.md` → `docs/vercel-admin-deploy.md` / `docs/web-app-deploy.md`. Owner+reviewer logins in `CREDENTIALS.local.md` (git-ignored). YouTube channel switch is backend-only (no app update). ✅ Accepted: P1–5, 7, 9, 10. ⚠ P6 & P8 still 🟡 (manual QA in flight).

**Shipped 2026-06-01 (LIVE on `main`):** (1) **D-205** named offline-class scheduling + attendance across mobile+web+admin+backend — migration applied (ledger `20260601014957`) + `session-create-ad-hoc` v4 deployed; (2) **`apps/admin` professional UI/UX redesign** (brand theme, responsive, loading motion — design-only). Both on `main` (`da5a048`), Vercel auto-deployed; advisors 0 ERROR. On-device QA: `OFFLINE-CLASS-ATTENDANCE-TEST.md`, `ADMIN-UI-REDESIGN-MANUAL-TEST.md`.

## Deploying to Vercel (admin + web) — the verified way
Both Vercel projects live in this one repo and **auto-deploy on every push to `main`** (no Vercel CLI, no dashboard click needed). Each builds only its own Root Directory.

| Surface | Vercel project / URL | Root Directory | Prod branch | Filter for local checks |
|---|---|---|---|---|
| Admin | behind `https://fyne-study-app-admin.vercel.app` | `apps/admin` | `main` | `@fynestudy/admin` |
| Web (PWA) | **must be named `fyne-study-web`** · domain `fynestudy.live` | `apps/web` | `main` (confirm Vercel → Settings → Git) | `@fynestudy/web` |

**Steps that worked (follow exactly):**
1. Work on your feature branch. Verify locally FIRST — never push unverified: `pnpm --filter <filter> typecheck && pnpm --filter <filter> lint && pnpm --filter <filter> build` (build catches Next-only errors typecheck misses, e.g. `useSearchParams` needing `<Suspense>`).
2. Stage **only your files** (`git add <paths>`) — do NOT bundle unrelated working-tree edits (e.g. an in-progress `CLAUDE.md` restructure). Commit.
3. Confirm a clean fast-forward, then push your commit straight onto `main` (no branch switch, leaves your working tree untouched):
   ```bash
   git fetch origin
   git merge-base --is-ancestor origin/main HEAD   # exit 0 = FF-safe; if not, rebase first
   git push origin HEAD:main                        # this push triggers the Vercel rebuild
   git push origin HEAD:<your-branch>               # keep your branch in sync
   git branch -f main HEAD                           # keep local main ref in sync
   ```
   `git push origin HEAD:main` is FF-only — Git rejects it if not a fast-forward, so it's safe (never `--force` to `main`).
4. Vercel → **Deployments**: wait for that commit hash to go green (~1–2 min).
5. **Verify in Incognito or hard-refresh (Ctrl+Shift+R).** Browser-cached JS is the #1 reason a fresh deploy "looks unchanged" — not a code problem.

**Env vars** (set in each Vercel project, not committed): `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` (publishable/anon only — never the service-role key; privileged writes go through edge fns). Detail: `docs/vercel-admin-deploy.md`, `docs/web-app-deploy.md`.

## Authoritative docs (read these first)
| Question | Open |
|---|---|
| Product? | `docs/project.md` |
| Why did we decide X? | `docs/decisions.md` (source of truth when specs disagree) |
| Where's the file for X? | `docs/file-structure.md` |
| DB schema / RLS / edge fn? | `docs/backend-architecture.md` |
| How does feature X work? | `docs/spec/<feature>.md` |
| Performance budget? | `docs/spec/performance.md` |
| Security baseline? | `docs/spec/security.md` |
| Convert app to web? | `Phases/` (root) → `Phases/00-overview-and-architecture.md` then 1→5 |

## Tech Stack
| Layer | Choice |
|---|---|
| Mobile | RN 0.81 + Expo SDK 54, iOS + Android both first-class |
| Routing | Expo Router 6 (file-based) |
| Styling | NativeWind 4 + Tailwind 3 |
| Mobile build | EAS Build + EAS Update |
| Admin | Next.js 15 + Tailwind + shadcn/ui on Vercel |
| Web | Next.js 15 + Tailwind 4 + shadcn + `@supabase/ssr` + serwist PWA on Vercel |
| Backend | Supabase (Postgres + Auth + Storage + Realtime + Edge Functions), `ap-south-1` |
| Live stream | YouTube Live Unlisted, wrapped via `react-native-youtube-iframe` |
| Chat | Supabase Realtime |
| PDF | `pdf-lib` in Edge Functions |
| WhatsApp | Gupshup *(deferred — P11 skipped)* |
| Crash / Analytics / CI / Math | Sentry / PostHog / GitHub Actions / KaTeX |

## Roles & Onboarding
Admin issues every account. **No self-signup, ever.**
1. Admin enters student + assigns batch (course derived).
2. System creates Supabase auth user + emails creds.
3. Student logs in → forced password change on first login.
4. Same for teachers.
5. Students/teachers cannot change own `batch`, `course`, `email`, `phone`, `dob`, `full_name`, `parent_phone` — must ask admin (D-016; matrix in `spec/authentication.md §10A`).
6. Multi-role supported (teacher + staff_admin common).

| Role | Logs in via | MFA | Notes |
|---|---|---|---|
| `student` | Mobile / Web | off | One batch at a time |
| `teacher` | Mobile / Web | optional | Can be in multiple batches |
| `staff_admin` | Web admin | optional (D-206) | Ops; cannot manage admins or institute settings |
| `owner_admin` | Web admin | optional (D-206) | Everything |

## Module Map
| Feature | Spec | Primary mobile route | Edge fn(s) |
|---|---|---|---|
| Auth | `spec/authentication.md` | `app/login.tsx`, `app/force-password-change.tsx` | `auth-bootstrap`, `auth-suspend` |
| Student dashboard | `spec/student-dashboard.md` | `app/(student)/index.tsx` | `mastery-recompute` |
| Attendance | `spec/attendance.md` | `app/(student)/attendance.tsx`, `app/(teacher)/scan.tsx`, `app/roster/[sessionId].tsx` | `attendance-qr-sign`, `attendance-qr-verify`, `attendance-correct` |
| Practice quizzes | `spec/practice-quizzes.md` | `app/quiz/[id].tsx` | `quiz-start`, `quiz-submit` |
| Exams | `spec/examinations.md` | `app/exam/[id].tsx`, `app/exam-builder/[examId].tsx` | `exam-start`, `exam-submit`, `exam-release-results`, `exam-regrade`, `exam-tab-switch` |
| Live + recordings | `spec/youtube-live-stream.md` | `app/live/[sessionId].tsx`, `app/live-control/[sessionId].tsx` | `yt-broadcast-create`, `yt-broadcast-golive`, `yt-broadcast-stop`, `yt-playback-sign` |
| Library | `spec/study-materials.md` | `app/(student)/library.tsx`, `app/video/[contentId].tsx`, `app/pdf/[contentId].tsx` | `content-presign-upload`, `content-finalize`, `content-create-video` |
| Leaderboard | `spec/leaderboard-and-gamification.md` | `app/(student)/leaderboard.tsx`, `app/(student)/profile.tsx?tab=badges` | `streak-recompute`, `leaderboard-weekly-rollover`, `badge-evaluate` |
| Parents' report ⏭️ *(P11 skipped)* | `spec/parents-report.md` | (server only) | — |
| Admin panel | `spec/admin-panel.md` | `apps/admin/app/(dashboard)/*` | all |
| Teacher panel | `spec/teacher-panel.md` | `app/(teacher)/*` | per feature |
| Security / Performance | `spec/security.md` / `spec/performance.md` | n/a | n/a |

## Hard rules — always
- **iOS + Android both** verified every change. Don't ship one ahead.
- **Every user-data table has RLS on.** Service-role key only in edge fns.
- **Every privileged write goes through an edge function.** No service-role from app code.
- **Every edge fn checks `app_users.is_active = true`** after JWT verify. Suspended users get 401 even with cached token (closes ≤1h leak after `auth-suspend`).
- **Every admin write → `audit_log`** row with before/after JSON (`apps/admin/lib/audit.ts → withAudit`).
- **No `console.log` in prod builds.** Babel strips it; write better.
- **No PII in Sentry events.** Scrubbed in `Sentry.beforeSend`.
- **All Storage buckets private.** Access via short-lived signed URLs only.
- **Server is sole truth for exam timer + QR validity.** Never trust device clock.
- **Mobile-first.** Test on a real low-end device (Redmi 8A class) before declaring done.

## Hard rules — never
- ❌ Add self-signup (even temporarily / behind a flag).
- ❌ Send `is_correct` to client during a quiz/exam attempt.
- ❌ Expose YouTube video IDs or stream keys to non-creators.
- ❌ App-layer encryption on PII columns (over-eng; breaks RLS).
- ❌ Bypass RLS via service-role from app code.
- ❌ Cron job without idempotency check.
- ❌ Commit a `.env*` or any secret.
- ❌ `git push --force` to `main`, `--no-verify`, or destructive ops without explicit OK.
- ❌ Self-edit input for any identity field (D-016).

## Low-end device rules (full in `spec/performance.md`)
- Reference: Redmi 8A class (Android 9, 2 GB RAM).
- Cold start ≤ 3s; transitions ≤ 200ms; bundle ≤ 35MB OTA.
- `FlatList`/`SectionList` for lists > 20 items.
- `expo-image` with explicit dimensions + `memory-disk` cache.
- Only one WebView (wrapped YT) mounted at a time. Unmount on blur.
- Always unsubscribe Realtime channels on unmount.
- Exam screen: no Reanimated, no charts, no images outside questions.
- Animations default 200ms; respect `isReduceMotionEnabled`.

## Where bugs hide
- **Auth not resuming on focus** → `apps/mobile/lib/supabase.ts` + `lib/secure-store.ts`. Refresh token from `expo-secure-store`, not AsyncStorage.
- **QR scan failing** → `attendance-qr-verify`. Check HMAC freshness + session match + replay constraint. Server clock authoritative.
- **Exam timer drift** → client syncs `server_now` on entry + every 60s. Display only; server enforces cut.
- **Live class blank** → check `yt-playback-sign` payload, then `react-native-youtube-iframe` log; verify YT broadcast `status='live'`.
- **WebView memory creep** → cleanup on unmount; only one mounted; PostHog `live_class_left` should fire.
- **Realtime "ghost" subs** → grep `supabase.channel(` without matching `removeChannel`.
- **RLS empty result where data exists** → policies don't union; check helper `current_app_user_id()` non-null; verify `auth.uid()` present.
- **Mastery stale** → trigger `mastery-recompute` manually or wait for nightly cron; recompute is idempotent.

## When making changes
1. Find the spec (`docs/spec/<feature>.md`).
2. Check `docs/decisions.md` for binding constraints.
3. Trace data flow in `docs/backend-architecture.md`.
4. Order: schema migration → edge fn → mobile feature → UI.
5. Add/update tests next to source as `*.test.ts`.
6. Does this write deserve an `audit_log` row?
7. Run `pnpm typecheck && pnpm lint && pnpm test` before PR.

## Coding conventions
- TS strict. No `any` without justification comment.
- No comments explaining *what* — code says it. Only *why* when non-obvious.
- Files kebab-case. Components PascalCase. Hooks `useFoo`. Edge fns `verb-noun`. DB tables `snake_case` plural.
- Server state: TanStack Query. Client state: `useState`/`useReducer`; Zustand only if cross-cutting.
- Forms: react-hook-form + zod schemas from `packages/shared/validation/`.
- Path aliases `@/*` rooted at app root.

## Asking for guidance
- Where X implemented → spec first.
- Why we did X → `docs/decisions.md`.
- New feature → write `docs/spec/<name>.md`, link in module map, then code.
- Change a decision → new dated entry in `decisions.md` referencing superseded one. **Never delete.**

## Demo & doubt
- Demo flow + seed + accounts in `docs/project.md §9`. Demo must be boringly reliable.
- Reliability > cleverness · Server enforcement > client trust · Smaller bundles > richer animations · Documented > undocumented · Boring tech > novel tech.

## File entry points
- Mobile: `apps/mobile/app/_layout.tsx`
- Admin: `apps/admin/app/layout.tsx`
- Web: `apps/web/app/layout.tsx` · middleware `apps/web/middleware.ts`
- Edge fns: `apps/functions/*/index.ts`
- Migrations: `supabase/migrations/`
- Shared: `packages/shared/`, `packages/supabase-types/`

## Help
- `/help` for Claude Code. Issues: https://github.com/anthropics/claude-code/issues.
