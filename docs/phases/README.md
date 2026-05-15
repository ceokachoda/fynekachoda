# Phases — Roadmap & Kickoff Prompts

> 12 phases from current state (Phase 2 closed — identity, auth, RLS done) to production-ready coaching OS. Each phase is a **vertical slice** — backend + frontend together — designed to be testable end-to-end before moving on. After every phase: user tests, reviews, accepts → only then does the next phase begin.

> ⚠️ **Before starting any phase, read [`docs/external-setup-timeline.md`](../external-setup-timeline.md).** Several external accounts (YouTube channel verification, Gupshup WhatsApp Business, Apple Developer Program, OAuth refresh tokens) have multi-day lead times. They must be started in parallel with code work or they will block later phases.

---

## Rules of engagement

1. **One phase at a time.** Don't combine. Don't skip.
2. **Every phase ends green.** Lint, typecheck, tests all pass. CI green on the phase branch.
3. **Every phase is reviewable.** The Acceptance Criteria are listed in each phase doc; all must pass before next phase begins.
4. **Rollback plan exists.** Every phase doc has one. If something breaks, we revert before fixing — `main` is never left half-broken.
5. **Specs are the contract.** Phase docs implement specs. If implementation drifts, update the spec (and `docs/decisions.md` if it's a new decision) — don't leave the spec stale.
6. **Existing frontend is edited in-place.** Every phase's "Frontend → files edited / deleted" section is explicit about what's touched. No silent churn.
7. **No combining "for efficiency."** Better to ship 12 clean increments than 6 muddy ones.

## Phase index

| # | Title | Status | Test command(s) |
|---|---|---|---|
| 1 | Foundation & Infrastructure | ✅ **accepted 2026-05-14** — see [`phase-1.md §13`](phase-1.md) | `pnpm typecheck`, `pnpm dev:mobile`, visit admin Vercel preview |
| 2 | Identity & Authentication | ✅ **accepted 2026-05-15** — see [`phase-2.md §14`](phase-2.md) | `pnpm typecheck`, `pnpm --filter @fynestudy/mobile test`, `pnpm smoke:cp5`, `pnpm smoke:cp8`, `pnpm test:rls` |
| 3 | Courses, Batches, Curriculum | ✅ **accepted 2026-05-15** — see [`phase-3.md §14`](phase-3.md) | `pnpm typecheck`, `pnpm --filter @fynestudy/mobile test`, `pnpm --filter @fynestudy/shared test`, `pnpm test:rls`, `pnpm smoke:batch-transfer`, `pnpm smoke:curriculum`, `pnpm smoke:batch-mutate`, `pnpm smoke:mfa-recovery` |
| 4 | Sessions & Attendance | ⏳ next | Manual flow per `phase-4.md §AC` |
| 5 | Study Materials Library | pending | Manual flow per `phase-5.md §AC` |
| 6 | Practice Quizzes | pending | Manual flow per `phase-6.md §AC` |
| 7 | Graded Exams | pending | Manual flow per `phase-7.md §AC` |
| 8 | Mastery, Streaks, Dashboard | pending | Manual flow per `phase-8.md §AC` |
| 9 | Live Classes (YouTube wrap) | pending | Manual flow per `phase-9.md §AC` |
| 10 | Leaderboard & Gamification | pending | Manual flow per `phase-10.md §AC` |
| 11 | Parents' WhatsApp Report | pending | Manual flow per `phase-11.md §AC` |
| 12 | Admin Completion, Hardening, Demo, Production Deploy | pending | Full demo run + production health check |

---

## How to use these kickoff prompts

Each prompt below is **self-contained**: paste it verbatim as the very first message of a brand-new Claude Code conversation, and the agent will pick up the project cold with the same working style established in earlier phases (checkpoint pauses, step-by-step verification for a coding-newcomer user, MCP-driven Supabase work, no auto-commit, ledger writeup at the end).

Prompts for **already-accepted phases** (1, 2) are marked closed — don't re-run them. If you need to revisit a closed phase, fix it in a follow-up branch with the appropriate prompt below.

If a prompt feels short for the work in front of you, that's intentional — most context comes from `CLAUDE.md` + memory + the phase doc itself, which the agent is instructed to read **before** doing anything. The prompt's job is to put it on the right rail.

---

## ✅ Phase 1 — Foundation & Infrastructure — closed 2026-05-14

Accepted in PR #1 (commit `ef8c0cf` merged to `main` as `bea08b2`). Full ledger in [`phase-1.md §13`](phase-1.md). Three ACs deferred by explicit user decision (#7 Sentry, #8 PostHog, #15 Android APK install). Do not re-run this prompt.

## ✅ Phase 2 — Identity & Authentication — closed 2026-05-15

Accepted with all checkpoints CP1–CP9 green; ledger in [`phase-2.md §14`](phase-2.md). 16 of 20 ACs pass, 2 partial (#3 TOTP recovery codes, #10 profile phone/DOB display) — **both fully resolved in Phase 3 CP9/CP11**. 1 deferred (#19 Redmi 8A cold-start), 1 pending PR (#20 CI). Carry-overs handed off to Phase 3. Do not re-run this prompt.

## ✅ Phase 3 — Courses, Batches, Curriculum — closed 2026-05-15

Accepted with all checkpoints CP1–CP12 green; ledger in [`phase-3.md §14`](phase-3.md). 16 of 17 ACs pass, 1 pending PR (#17 CI). Phase 2 carry-overs resolved: TOTP recovery codes (CP11), profile phone/DOB display (CP9), backend-architecture §3 sweep (CP11). Three durable architectural decisions added: D-152 (teacher batch-scope on `app_users`), D-153 (single-call `auth-change-own-password` supersedes mobile-side `updateUser`), D-154 (30s auth timeout + `sessionLanded()` fallback for iOS Expo Go). Carry-overs handed off to Phase 4: Vercel admin deployment fix (currently stuck on Phase 1 placeholder), admin "Reset MFA on another admin" UI (Phase-12-dependent), Android cold-start measurement, Sentry+PostHog wiring, 16 performance advisor INFOs. Do not re-run this prompt.

---

## 🏫 Phase 3 — Courses, Batches, Curriculum (kickoff prompt — closed, do not re-run)

```
You are continuing work on FyneStudy — a hybrid coaching-institute OS for JEE/NEET/CUET prep, built as a pnpm monorepo (mobile + admin + Supabase backend).

REPO: C:\Users\kaust\OneDrive\Desktop\FyneStudyLive
SUPABASE DEV PROJECT REF: orqwyazvcthgxoadfxfv
GIT BRANCH: main (Phase 2 work is uncommitted; will be merged in a PR before Phase 3 lands its first commit)

BEFORE WRITING ANY CODE, read these files in order:
1. CLAUDE.md (repo root) — hard rules, tech stack, module map, debugging map. Confirm the "Status" block shows Phase 2 ✅ accepted.
2. Every file linked from ~/.claude/projects/C--Users-kaust-OneDrive-Desktop-FyneStudyLive/memory/MEMORY.md — these are durable user preferences + project decisions that persist across conversations.
3. docs/phases/phase-3.md — this phase's spec. Read end to end. The "STOP. Checkpoint X." markers are mandatory pause points.
4. docs/phases/phase-2.md §13 (Hand-off to Phase 3) AND §14 (Acceptance Ledger) — picks up the carry-overs (TOTP recovery codes, profile phone/DOB display, schema-doc drift sweep).
5. docs/decisions.md — search for any D-NNN that touches courses, batches, curriculum, RLS, or teacher access. Specs disagree with decisions.md → decisions.md wins.
6. docs/spec/admin-panel.md + docs/spec/student-dashboard.md + docs/spec/teacher-panel.md — the parts that describe course/batch surfaces.

USER CONTEXT (from memory; treat as durable):
- User is new to coding. Every "verify this" you ask of them must be click-by-click with exact URLs, exact button names, exact expected screen text. NOT "log into the admin panel" — INSTEAD "open Chrome, go to https://admin-kohl-sigma.vercel.app/login, type owner@fynestudy.example.com in Email, type FyneStudy01 in Password (no exclamation), tap Sign in, enter your 2FA code from your authenticator app, tap Verify".
- User invites deep Q&A on specs but trusts you to drive implementation. "Choose what's best" is genuine — pick aggressively, summarize defaults in a table.
- Demo owner is owner@fynestudy.example.com / FyneStudy01 (already TOTP-enrolled). Memory file project_demo-owner.md has full credentials including the existing CP5/CP8 smoke students.

WORKING PROTOCOL:
1. Work through phase-3.md in order, one checkpoint at a time.
2. At each "STOP. Checkpoint X." in the doc, produce a structured summary with five sections: (a) what was done, (b) mechanical verification you ran with exit codes / pass counts, (c) deliberate deviations from the doc + why, (d) what the user must verify manually (click-by-click), (e) what they do NOT need to verify (mechanical proof above is sufficient). Then PAUSE and wait for "Checkpoint X OK" before continuing.
3. Never auto-commit. Never push. Never open a PR without explicit "open the PR" approval.
4. Never auto-accept the phase. After the last checkpoint, append §X Acceptance Ledger to phase-3.md mirroring the format of phase-2.md §14, then PAUSE and wait for "Phase 3 accepted" before any tag / merge.
5. Use the Supabase MCP for all DB work: list_migrations, apply_migration, execute_sql, get_logs, deploy_edge_function, get_advisors. Resolve every advisor lint that fires on your migrations before moving past CP2-equivalent — don't ship with red advisors.
6. Use Bash for repo-local commands (pnpm, git status, lint, test). For long outputs use sub-agents (Explore, general-purpose) — don't pull a full grep result into main context if a summary will do.
7. Use AskUserQuestion at real forks (two roughly equal options with different trade-offs). Don't ask for trivial choices.
8. Before any /compact: save anything cross-conversation-worthy to ~/.claude/projects/C--Users-kaust-OneDrive-Desktop-FyneStudyLive/memory/ with the conventions described in the memory section of your system prompt. Update MEMORY.md index.

HARD RULES carried from CLAUDE.md (non-negotiable):
- Every user-data table has RLS on. Every privileged write goes through an edge function. Every edge fn checks app_users.is_active=true after JWT verify. Every admin write writes an audit_log row.
- No self-signup. No service-role from app code. No console.log in production. No PII in Sentry. Private Storage buckets, signed URLs only. Server is source of truth for time-sensitive ops.
- D-016: students/teachers cannot self-edit identity fields (extend to batch_id for students).
- D-146: RLS helper functions live in `private` schema, not `public`. Use private.is_admin() / private.has_role() / private.current_app_user_id() in new policies.
- D-148: every mobile Supabase auth call + edge-fn fetch wraps in withTimeout (apps/mobile/features/auth/network-errors.ts). Apply the same pattern to any new mobile data-fetch helpers you write.

PHASE 3 SCOPE (high-level — see phase-3.md for detail):
- Add courses, subjects, chapters, topics, batches, batch_teachers tables.
- Migrate students.batch_id from nullable to NOT NULL with a seeded default first batch (so existing Phase 2 students don't break).
- Wire the teacher batch-scope RLS policy (currently teachers see 0 students per RLS test #2 — Phase 3 changes that).
- Admin UI for course/batch CRUD + teacher assignment + student-to-batch assignment.
- No mobile UI work in Phase 3 beyond what's needed to verify (the student "My Batch" widget is Phase 3.X minor; the leaderboard etc. lands in later phases).

START: After reading the files above, say "Ready to start Phase 3 CP1." with a one-paragraph plan of CP1's scope drawn from phase-3.md, then PAUSE and wait for "go".
```

## 🎟️ Phase 4 — Sessions & Attendance

```
You are continuing work on FyneStudy — a hybrid coaching-institute OS for JEE/NEET/CUET prep, built as a pnpm monorepo (mobile + admin + Supabase backend). Phase 3 (Courses, Batches, Curriculum) is accepted — full ledger in docs/phases/phase-3.md §14.

REPO: C:\Users\kaust\OneDrive\Desktop\FyneStudyLive
SUPABASE DEV PROJECT REF: orqwyazvcthgxoadfxfv
GIT BRANCH: main (Phase 2 + Phase 3 work is uncommitted; one big PR opens before Phase 4 lands a commit)

BEFORE WRITING ANY CODE, read these files in order:
1. CLAUDE.md (repo root) — confirm the "Status" block shows Phase 3 ✅ done — 2026-05-15 with all 12 CPs green. Hard rules, tech stack, module map, debugging map all live here.
2. Every file linked from ~/.claude/projects/C--Users-kaust-OneDrive-Desktop-FyneStudyLive/memory/MEMORY.md — durable user preferences + project decisions + hard-learned lessons. Read ALL of them. The Phase-3-specific memories are project_phase-3-status.md, project_phase-3-decisions.md, project_auth-client-timeouts.md.
3. docs/phases/phase-4.md — this phase's spec. Read end to end. The "STOP. Checkpoint X." markers are mandatory pause points.
4. docs/phases/phase-3.md §14 (Acceptance Ledger) — Phase 3 ledger + hand-off + 7 carry-overs into Phase 4 (notably Vercel admin redeploy, admin "Reset MFA" UI, performance-advisor housekeeping).
5. docs/decisions.md — search for D-NNN touching attendance, QR, HMAC, rotating tokens, session correctness, sessions table, batch_schedule materialisation. Specs disagree with decisions.md → decisions.md wins.
6. docs/spec/attendance.md — feature spec. Section on HMAC freshness + replay protection is the high-stakes part of Phase 4.
7. docs/backend-architecture.md §3.3 — target schema for sessions + attendance (currently target, not applied).

USER CONTEXT (durable, from memory; DO NOT need to re-confirm):
- User is new to coding. Every "verify this" must be click-by-click with exact URLs, exact button names, exact expected screen output.
- User invites deep Q&A on specs but trusts the AI to drive implementation. "Choose what's best" is genuine — pick aggressively, summarize defaults in a table.
- Demo owner: owner@fynestudy.example.com / FyneStudy01 / TOTP-enrolled. Memory file project_demo-owner.md has full credentials.

WORKING PROTOCOL:
1. Work through phase-4.md in order, one checkpoint at a time.
2. At each "STOP. Checkpoint X." in the doc, produce a structured summary with five sections: (a) what was done, (b) mechanical verification you ran with exit codes / pass counts, (c) deliberate deviations from the doc + why, (d) what the user must verify manually (click-by-click with exact URLs / button names / expected text), (e) what they do NOT need to verify (mechanical proof above is sufficient). Then PAUSE and wait for "Checkpoint X OK" before continuing.
3. Never auto-commit. Never push. Never open a PR without explicit "open the PR" approval.
4. Never auto-accept the phase. After the last checkpoint, append §14 Acceptance Ledger to phase-4.md mirroring the format of phase-3.md §14, then PAUSE and wait for "Phase 4 accepted" before any tag / merge.
5. Use the Supabase MCP for all DB work: list_migrations, apply_migration, execute_sql, get_logs, deploy_edge_function, get_advisors. Resolve every NEW advisor lint that fires on your migrations — don't ship with red advisors.
6. Use Bash for repo-local commands (pnpm, git status, lint, test). For long outputs use sub-agents (Explore, general-purpose) — don't pull a full grep result into main context.
7. Use AskUserQuestion at real forks (two roughly equal options with different trade-offs). Don't ask for trivial choices.
8. Use TaskCreate + TaskUpdate to track CPs from the start. Recreate the task list immediately.
9. Before any /compact, save anything cross-conversation-worthy to ~/.claude/projects/C--Users-kaust-OneDrive-Desktop-FyneStudyLive/memory/. Update MEMORY.md index.

HARD RULES carried from CLAUDE.md (non-negotiable):
- All Phase 1–3 hard rules still apply. Specifically for Phase 4:
- "Server is the only source of truth for QR validity. Never trust device clock."
- "Every edge function checks app_users.is_active=true after JWT verification."
- D-030 (rotating QR, 30-second HMAC-signed token, replay-impossible) — verify on a real phone, not just unit tests.
- HMAC secret rotation policy (D-104, quarterly with 24h grace).
- D-146: RLS helper functions live in `private` schema, not `public`. Use private.is_admin() / private.has_role() / private.current_app_user_id() in new policies.
- D-152 (Phase 3 CP10): when a new table needs teacher batch-scope read for use in mobile embeds, mirror the `app_users_teacher_batch_read` policy shape — without it, embedded joins silently RLS-null.
- D-153 (Phase 3 CP10): mobile NEVER calls `supabase.auth.updateUser` itself in the force-password-change flow. The `auth-change-own-password` edge fn is the single-call replacement. If Phase 4 needs to mutate sessions / users, use the same server-side pattern.
- D-154 (Phase 3 CP10): all mobile `supabase.auth.*` calls wrap in `withTimeout(_, 30_000)` and check `supabase.auth.getSession()` after a timeout. All mobile `supabase.from()` / `supabase.functions.invoke()` calls wrap in `withTimeout(_, 15_000)` (default).

PHASE 4 SCOPE (high-level — see phase-4.md for detail):
- DB tables: `sessions` (materialised from `batch_schedule` + ad-hoc), `attendance` (per-student per-session record).
- Edge fns: `attendance-qr-sign` (student-side, emits HMAC payload), `attendance-qr-verify` (teacher-side, validates HMAC + freshness + dedup), `attendance-correct` (teacher amends, audit row).
- Mobile: `(student)/attendance.tsx` (rotating QR display), `(teacher)/scan.tsx` (camera + decode + verify), `(teacher)/roster/[id].tsx` (manual fallback).
- Admin: session list + per-session attendance report. NOT in scope: live class hookup (Phase 9) or attendance-driven leaderboard score (Phase 10).

KNOWN PHASE-3 CARRY-OVERS (to address opportunistically or defer):
- Vercel admin deployment is currently stuck on the Phase 1 "Coming online…" placeholder. The Phase 3 PR (opened before Phase 4 begins coding) is the first push that rebuilds Vercel with Phase 2 + Phase 3 admin surface.
- 16 performance advisor INFOs on existing Phase 2/3 tables (multiple permissive policies on every authenticated SELECT — intentional pattern; unindexed FKs on rare-query columns; one auth_rls_initplan on `app_users_self_read`). Phase 4 should not regress these and may opportunistically tidy with a small migration if it doesn't bloat the phase.

START: After reading the files above, say "Ready to start Phase 4 CP1." with a one-paragraph plan of CP1's scope drawn from phase-4.md, then PAUSE and wait for "go". Do NOT recreate any work already done in Phase 3 — verify via list_migrations / Glob / git status before adding anything.
```

## 📚 Phase 5 — Study Materials Library

```
You are continuing work on FyneStudy. Phase 4 (Sessions & Attendance) is accepted.

REPO: C:\Users\kaust\OneDrive\Desktop\FyneStudyLive
SUPABASE DEV PROJECT REF: orqwyazvcthgxoadfxfv

READ FIRST: CLAUDE.md (Status block confirms Phase 4 accepted), MEMORY.md + linked memories, docs/phases/phase-5.md, docs/phases/phase-4.md §X Ledger, docs/decisions.md (search YouTube, PDF, watermark, storage, signed URLs), docs/spec/study-materials.md, docs/spec/youtube-live-stream.md.

USER + WORKING PROTOCOL: same as Phase 3 — checkpoint pauses, click-by-click user verification, no auto-commit, ledger at end, save to memory before /compact, MCP for Supabase.

HARD RULES specifically for Phase 5:
- "Expose YouTube video IDs or stream keys to non-creators" is FORBIDDEN. Signed/wrapped playback only.
- "All Storage buckets private. Access via short-lived signed URLs only."
- One WebView mounted at a time (low-end device perf rule from CLAUDE.md).
- Watermark every PDF render with the viewer's email + timestamp.

PHASE 5 SCOPE: content_items table + Storage buckets + library tree UI (Subject → Chapter → Topic → { Video | PDF | Note }) + wrapped YT player + watermarked in-app PDF reader. Verify on a real low-end Android device (Redmi 8A class) before declaring AC met.

START: After reading, say "Ready to start Phase 5 CP1." with a one-paragraph plan, then PAUSE.
```

## 📝 Phase 6 — Practice Quizzes

```
You are continuing work on FyneStudy. Phase 5 (Study Materials Library) is accepted.

REPO: C:\Users\kaust\OneDrive\Desktop\FyneStudyLive
SUPABASE DEV PROJECT REF: orqwyazvcthgxoadfxfv

READ FIRST: CLAUDE.md (confirm Phase 5 accepted), MEMORY.md + linked memories, docs/phases/phase-6.md, docs/phases/phase-5.md §X Ledger, docs/decisions.md (search quiz, marking, retake, solution, answer-leak), docs/spec/practice-quizzes.md.

USER + WORKING PROTOCOL: same as Phase 3 — checkpoint pauses, click-by-click user verification, no auto-commit, ledger at end, save to memory before /compact, MCP for Supabase.

HARD RULES specifically for Phase 6:
- "Send is_correct to the client during a quiz/exam attempt" is FORBIDDEN. Server holds the answer key until the attempt is submitted.
- Self-paced retake allowed (this is the difference from Phase 7 exams).
- Solution view shows explanation + links the related video/PDF in the library.

PHASE 6 SCOPE: question_bank table + quizzes table + quiz_attempts table + edge fns quiz-start, quiz-submit + student attempt UI + teacher quiz-builder. NOT in scope: exam-style server-timer (Phase 7).

START: After reading, say "Ready to start Phase 6 CP1." with a one-paragraph plan, then PAUSE.
```

## 🎯 Phase 7 — Graded Exams

```
You are continuing work on FyneStudy. Phase 6 (Practice Quizzes) is accepted.

REPO: C:\Users\kaust\OneDrive\Desktop\FyneStudyLive
SUPABASE DEV PROJECT REF: orqwyazvcthgxoadfxfv

READ FIRST: CLAUDE.md (confirm Phase 6 accepted), MEMORY.md + linked memories, docs/phases/phase-7.md, docs/phases/phase-6.md §X Ledger, docs/decisions.md (search exam, timer, tab-switch, regrade, release), docs/spec/examinations.md.

USER + WORKING PROTOCOL: same as Phase 3 — checkpoint pauses, click-by-click user verification, no auto-commit, ledger at end, save to memory before /compact, MCP for Supabase. Verify by attempting clock-skew tests on a real device before declaring AC met.

HARD RULES specifically for Phase 7:
- "Server is the only source of truth for exam timer. Never trust device clock."
- Exam screen has NO Reanimated, NO charts, NO images outside questions (low-end perf rule).
- Tab-switch detection writes an event row (exam-tab-switch edge fn).
- Teacher releases results manually; regrade flow writes audit_log entries.

PHASE 7 SCOPE: exams table + exam_attempts table + locked-down attempt UI + server-side time-sync handshake + tab-switch instrumentation + teacher exam-builder + release / regrade flow. Reuses Phase 6's question_bank.

START: After reading, say "Ready to start Phase 7 CP1." with a one-paragraph plan, then PAUSE.
```

## 📊 Phase 8 — Mastery, Streaks, Dashboard

```
You are continuing work on FyneStudy. Phase 7 (Graded Exams) is accepted.

REPO: C:\Users\kaust\OneDrive\Desktop\FyneStudyLive
SUPABASE DEV PROJECT REF: orqwyazvcthgxoadfxfv

READ FIRST: CLAUDE.md (confirm Phase 7 accepted), MEMORY.md + linked memories, docs/phases/phase-8.md, docs/phases/phase-7.md §X Ledger, docs/decisions.md (search mastery, streak, dashboard, active-day, recompute), docs/spec/student-dashboard.md, docs/spec/teacher-panel.md.

USER + WORKING PROTOCOL: same as Phase 3 — checkpoint pauses, click-by-click user verification, no auto-commit, ledger at end, save to memory before /compact, MCP for Supabase. Verify cold-start budget (≤3s) on Redmi 8A class device — this is the phase where the real dashboard goes live.

HARD RULES specifically for Phase 8:
- Mastery = rolling average of last N=5 attempts per topic.
- Streak = "active day" rule (any qualifying action). No streak freezes (D-140 rejected).
- mastery-recompute and streak-recompute edge fns must be idempotent (D-106 cron rule).

PHASE 8 SCOPE: mastery table + streak table + nightly recompute crons + live student dashboard + teacher batch-perf view. All data sources from Phases 4–7 land here.

START: After reading, say "Ready to start Phase 8 CP1." with a one-paragraph plan, then PAUSE.
```

## 🎥 Phase 9 — Live Classes (YouTube wrap)

```
You are continuing work on FyneStudy. Phase 8 (Mastery, Streaks, Dashboard) is accepted.

REPO: C:\Users\kaust\OneDrive\Desktop\FyneStudyLive
SUPABASE DEV PROJECT REF: orqwyazvcthgxoadfxfv

READ FIRST: CLAUDE.md (confirm Phase 8 accepted), MEMORY.md + linked memories, docs/phases/phase-9.md, docs/phases/phase-8.md §X Ledger, docs/decisions.md (search YouTube, OAuth, OBS, broadcast, chat, raise-hand), docs/spec/youtube-live-stream.md, docs/external-setup-timeline.md (verify YT channel verification + OAuth refresh tokens are ready BEFORE writing code — this phase is the most external-dependency-heavy).

USER + WORKING PROTOCOL: same as Phase 3 — checkpoint pauses, click-by-click user verification, no auto-commit, ledger at end, save to memory before /compact, MCP for Supabase.

HARD RULES specifically for Phase 9:
- YouTube channel + OAuth refresh tokens MUST be in place before CP1. If not, STOP and tell user — don't write speculative code.
- Stream keys never reach non-creators.
- Wrapped player only — never expose raw YT video IDs in the API surface or app code.
- Only one WebView mounted at a time; unmount on screen blur (the perf rule from CLAUDE.md).
- Chat is Supabase Realtime; ensure unsubscribe on unmount (the "ghost subscriptions" bug from CLAUDE.md debugging map).

PHASE 9 SCOPE: yt-broadcast-create + yt-broadcast-stop + yt-playback-sign edge fns + live-class screens (student watch + teacher control + chat + raise-hand) + recording playback. NOT in scope: live-class-driven attendance bonus (Phase 10 if at all).

START: After reading, say "Ready to start Phase 9 CP1." with a one-paragraph plan, then PAUSE.
```

## 🏆 Phase 10 — Leaderboard & Gamification

```
You are continuing work on FyneStudy. Phase 9 (Live Classes) is accepted.

REPO: C:\Users\kaust\OneDrive\Desktop\FyneStudyLive
SUPABASE DEV PROJECT REF: orqwyazvcthgxoadfxfv

READ FIRST: CLAUDE.md (confirm Phase 9 accepted), MEMORY.md + linked memories, docs/phases/phase-10.md, docs/phases/phase-9.md §X Ledger, docs/decisions.md (search leaderboard, badge, composite, weekly, rollover), docs/spec/leaderboard-and-gamification.md.

USER + WORKING PROTOCOL: same as Phase 3 — checkpoint pauses, click-by-click user verification, no auto-commit, ledger at end, save to memory before /compact, MCP for Supabase.

HARD RULES specifically for Phase 10:
- Composite score formula: 60% scores / 25% attendance / 15% streak (locked decision).
- Weekly rollover via pg_cron + idempotency check (D-106).
- Badge evaluation is server-side; client never decides badge eligibility.

PHASE 10 SCOPE: leaderboard_weekly + badges + badge-evaluate edge fn + leaderboard screen + badge celebrations. Composition phase — most data already exists from Phases 4–8.

START: After reading, say "Ready to start Phase 10 CP1." with a one-paragraph plan, then PAUSE.
```

## 📱 Phase 11 — Parents' WhatsApp Report

```
You are continuing work on FyneStudy. Phase 10 (Leaderboard & Gamification) is accepted.

REPO: C:\Users\kaust\OneDrive\Desktop\FyneStudyLive
SUPABASE DEV PROJECT REF: orqwyazvcthgxoadfxfv

READ FIRST: CLAUDE.md (confirm Phase 10 accepted), MEMORY.md + linked memories, docs/phases/phase-11.md, docs/phases/phase-10.md §X Ledger, docs/decisions.md (search WhatsApp, Gupshup, parents, PDF, template), docs/spec/parents-report.md, docs/external-setup-timeline.md (verify Gupshup business account + approved templates BEFORE writing code).

USER + WORKING PROTOCOL: same as Phase 3 — checkpoint pauses, click-by-click user verification, no auto-commit, ledger at end, save to memory before /compact, MCP for Supabase.

HARD RULES specifically for Phase 11:
- Gupshup template approval has multi-day lead time. If templates aren't approved at CP1 start, STOP and tell user.
- D-003: parents have NO app login. WhatsApp PDF only.
- Template variable count in the payload must match Gupshup's approved template exactly (the "template_param_error" bug in CLAUDE.md debugging map).
- gupshup-callback retries on failure with backoff (whatsapp-retry edge fn).

PHASE 11 SCOPE: parent-report-generate + whatsapp-send + gupshup-callback + whatsapp-retry edge fns + PDF generation (pdf-lib) + weekly cron + on-demand report from admin panel.

START: After reading, say "Ready to start Phase 11 CP1." with a one-paragraph plan, then PAUSE.
```

## 🚢 Phase 12 — Admin Completion, Hardening, Demo, Production Deploy

```
You are continuing work on FyneStudy. Phase 11 (Parents' WhatsApp Report) is accepted. This is the final phase.

REPO: C:\Users\kaust\OneDrive\Desktop\FyneStudyLive
SUPABASE DEV PROJECT REF: orqwyazvcthgxoadfxfv
PRODUCTION SUPABASE: will be provisioned in this phase.

READ FIRST: CLAUDE.md (confirm Phase 11 accepted), MEMORY.md + linked memories, docs/phases/phase-12.md, docs/phases/phase-11.md §X Ledger, docs/decisions.md FULL (this phase touches every feature), every docs/spec/*.md (verify no spec contradicts the shipped code).

USER + WORKING PROTOCOL: same as Phase 3 — checkpoint pauses, click-by-click user verification, no auto-commit, ledger at end, save to memory before /compact, MCP for Supabase.

CRITICAL: This phase ends with the PRODUCTION CUTOVER. You do NOT cut over without explicit "go live" approval AFTER the demo dry-run has been verified by the user. The cutover steps are exactly:
1. Run final demo dry-run on dev project — every spec feature exercised end-to-end.
2. User reviews demo, says "demo accepted".
3. Provision production Supabase project (different ref) + production Vercel target.
4. Migrate dev → prod with `supabase db dump` + selective seed.
5. Cut DNS, point mobile EAS prod channel + admin prod domain at new project.
6. Smoke-test prod with the demo flow (read-only) BEFORE handing keys to user.
7. User says "go live" — then update DNS / mark prod public.

HARD RULES specifically for Phase 12:
- Production secrets NEVER touch the dev project. Two separate `.env.production` files (admin + edge fns).
- Sentry + PostHog wiring lands here (carry-over from Phase 1 deferrals).
- Runbook (docs/runbook.md) + incident playbook (docs/incident-playbook.md) drafted before cutover.
- Demo seed + pre-baked accounts created so the user's first demo to a real client is boringly reliable.

PHASE 12 SCOPE: admin completion sweep (any partial UI), security audit pass (every edge fn re-reviewed), Sentry+PostHog wiring, EAS production builds, production cutover. Plus a doc sweep — every spec file ends Phase 12 in green.

START: After reading, say "Ready to start Phase 12 CP1." with a one-paragraph plan, then PAUSE.
```

---

## Acceptance protocol

For each phase:

1. Claude announces "Phase N complete. Acceptance Criteria:" and lists every AC item with how it was verified.
2. You run through the AC list yourself — manually (click-by-click instructions from Claude) or via the listed commands.
3. If all pass → reply `Phase N accepted, begin Phase N+1` (or open a new conversation and paste the next phase's kickoff prompt).
4. If something fails → tell Claude precisely what failed; Claude fixes it; re-verify.
5. **Do not start Phase N+1 with anything failing in Phase N.** Production-level discipline.

## Memory + conversation hygiene

Each phase typically spans multiple conversations (context windows compact long before a 9-checkpoint phase finishes). The phase kickoff prompts above are designed so a fresh conversation can resume cleanly:

1. **Read MEMORY.md first.** Every linked file under `~/.claude/projects/C--Users-kaust-OneDrive-Desktop-FyneStudyLive/memory/` captures durable preferences + project decisions.
2. **Before /compact**, save anything cross-conversation-worthy: rules the user gave you, project decisions made in this session, surprising bug causes that don't live in code/git.
3. **After /compact**, re-read MEMORY.md if you suspect drift.
4. **Don't trust frozen memory snapshots** for fast-changing state (recent commits, current branch state). Use `git log` / current file reads.

## What happens AFTER Phase 12

Phase 12 ends with:
- Production Supabase project, Vercel admin deployment, EAS-built mobile binaries
- Demo seed data + pre-baked accounts
- Sentry alerts + PostHog dashboards configured
- Runbook in `docs/runbook.md` (drafted in Phase 12)
- Incident response playbook in `docs/incident-playbook.md`

At that point, the **client demo** is ready. Post-demo, the deferred items (payments, push notifications, multi-branch — see `decisions.md §"Out of MVP"`) become candidates for the next roadmap.

## Cross-phase rules (never break these)

- **No phase touches a feature outside its scope.** If you find a bug in a different feature, log it under `docs/known-issues.md` (create the file lazily) and address in its own phase.
- **No half-done frontend.** If a screen is touched, it ends the phase complete — no "we'll wire it up later" notes.
- **No silent breakage of past phases.** Every phase's CI includes a regression check on all prior phases' tests.
- **No bypassing RLS to make tests pass.** If a test needs special access, use a `service_role` helper in tests, never weaken the policy.
- **No skipping audit log** on admin writes.
- **No new dependencies without justification.** New package added → mention it in the phase doc with a one-line reason.

## Estimated effort (very rough)

| Phase | Est. effort | Notes |
|---|---|---|
| 1 | 3–4 days | ✅ done in 1 day calendar (Phase 1 closed 2026-05-14) |
| 2 | 4–5 days | ✅ done in ~1 day calendar (Phase 2 closed 2026-05-15) — checkpoint pacing made the actual work feel longer |
| 3 | 3–4 days | CRUD + curriculum tree UX |
| 4 | 4–5 days | Camera + HMAC are tricky |
| 5 | 4–5 days | Watermark + PDF reader on low-end |
| 6 | 4–5 days | Quiz UI is content-heavy |
| 7 | 4–6 days | Server-time + tab-switch + locked-down UX |
| 8 | 3–4 days | Mostly composing existing data |
| 9 | 6–8 days | Most external-integration risk |
| 10 | 3–4 days | Straightforward composition |
| 11 | 4–6 days | Gupshup approval can stall this |
| 12 | 5–7 days | Hardening + demo prep + deploy |

Totals ~50–60 days of focused work. Real calendar time depends on Gupshup approval, YT verification, and the user's review pace.
