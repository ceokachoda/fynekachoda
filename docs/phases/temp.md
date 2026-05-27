# temp.md — stale debug fragment

> ⚠️ **Stale.** This file held a one-off resume hint from a Phase 1 CP4 debug session (Expo Metro LAN-IP issue). Kept here only so the historical reference doesn't 404 from any link that might exist somewhere.
>
> The underlying issue (iPhone Expo Go can't reach Metro on Wi-Fi) was permanently fixed by `scripts/dev.js` auto-detecting the LAN IP and exporting it as `REACT_NATIVE_PACKAGER_HOSTNAME`. See [Phase 1 ledger §13 — "Deliberate deviations from the original Phase 1 doc"](phase-1.md#13-acceptance-ledger--closed-2026-05-14), entry #5.
>
> Safe to ignore. Safe to delete if you don't like loose files in the docs tree.



 📊 Phase 8 kickoff prompt (autonomous — paste verbatim into a fresh conversation)

  This version runs all checkpoints autonomously (no per-CP pause), drives to 🟡 CODE-COMPLETE, writes the ledger + manual-test plan + seed, then stops for
  you to do manual QA separately — exactly how 5/6/7 actually went. It's also now saved in README.md §Phase 8.

  You are continuing work on FyneStudy — a hybrid coaching-institute OS for JEE/NEET/CUET prep, built as a pnpm monorepo (mobile + admin + Supabase
  backend). Phase 7 (Graded Exams) is ACCEPTED — full ledger in docs/phases/phase-7.md §15.

  REPO: C:\Users\kaust\OneDrive\Desktop\FyneStudyLive
  SUPABASE DEV PROJECT REF: orqwyazvcthgxoadfxfv
  GIT BRANCH: phase-4 (Phases 2–7 + their QA fixes are all UNCOMMITTED on this branch; the user owns the eventual consolidated PR — DO NOT commit, push,
  branch, or open a PR).

  ═══════════════════════════════════════════════════════════════
    EXECUTION MODE — AUTONOMOUS (different from Phases 3–7)
  ═══════════════════════════════════════════════════════════════
  Run the ENTIRE phase end-to-end WITHOUT pausing at each checkpoint. Do every checkpoint (CP1 → CP13) and everything you can verify yourself: coding,
  migrations, edge fns, unit tests, RLS smokes, edge-fn HTTP smokes, typecheck, lint, mobile jest, advisor sweeps, EXPLAIN ANALYZE perf checks. Do NOT wait
  for "go" or "Checkpoint X OK". Only pause for: (a) a genuine fork where two options have materially different trade-offs (AskUserQuestion), (b) a
  user-facing copy decision, (c) a destructive op, or (d) needing to touch a DIFFERENT phase's surface to fix a Phase 8 bug.

  The END STATE you drive to is "🟡 CODE-COMPLETE, MANUAL QA PENDING" — exactly like Phases 5/6/7 reached. When all CPs are code-complete and every
  automated test is green:
    1. Append "§X Acceptance ledger" to docs/phases/phase-8.md mirroring phase-7.md §15 (CP table, migrations, edge fns, tests, advisor sweep, decisions,
  files-changed, carry-overs). Leave the ACCEPTED line blank.
    2. Write docs/phases/phase-8-manual-tests.md — click-by-click, ONLY the things automated tests can't cover (real-device dashboard render + cold-start
  budget, realtime invalidation, heatmap lag, streak-modal calendar visuals, next-card priority verified by scenario). Mirror phase-7-manual-tests.md,
  including a §0 seed/setup block and a §H "what I already verified — don't re-test" block.
    3. Add a seed script (scripts/seed-dashboard-manual-test.ts + `pnpm seed:dashboard-manual-test` with a `--reset` flag) planting a few students with
  varied attendance/quiz/exam/offline patterns so each dashboard signal is exercisable.
    4. Update memory: create project_phase-8-status.md (🟡 CODE-COMPLETE) + project_phase-8-decisions.md, add both to MEMORY.md, and add a Phase 8 🟡 line
  to CLAUDE.md's Status block.
    5. Set docs/phases/phase-8.md status to "🟡 CODE-COMPLETE, MANUAL QA PENDING".
  Then STOP and report: what's code-complete, automated test pass-counts, and the manual-QA checklist the user must walk. The user runs manual QA in a
  SEPARATE prompt and signs off the ACCEPTED line — do NOT flip it yourself.

  READ FIRST (in order, before any code):
  1. CLAUDE.md — confirm Status shows Phase 7 ✅ done — 2026-05-21. Hard rules, tech stack, module map, debugging map, low-end-device rules, coding
  conventions.
  2. Every file linked from ~/.claude/projects/C--Users-kaust-OneDrive-Desktop-FyneStudyLive/memory/MEMORY.md. Read ALL. Especially project_phase-7-status,
  project_phase-7-decisions (D-179..D-183), project_phase-6-decisions (D-175..D-178), project_phase-5-decisions (D-166 trigger search_path, D-169 top-level
  routes, D-170 deploy temp-workdir, D-172 admin-via-edge-fn), feedback_supabase-verify-by-sql, feedback_metro-stale-bundle, feedback_expo-monorepo-dedup,
  feedback_cssinterop-bypass, feedback_focuseffect-object-dep, project_dev-mobile-wrapper, project_db-conventions, project_demo-owner.
  3. docs/phases/phase-8.md — this phase's spec, end to end (CP1 → CP13).
  4. docs/phases/phase-7.md §15 — Phase 7 ledger + carry-overs (the mastery-recompute wiring lands here).
  5. docs/decisions.md — search mastery, streak, dashboard, active-day, recompute, rolling-N, composite (D-070 rolling N=5, D-074, D-075, D-106 cron
  idempotency, D-140 streak-freeze rejected). decisions.md wins over specs on conflict; recent Phase 5–7 decisions live in their phase ledgers (phase-N.md
  §X).
  6. docs/spec/student-dashboard.md (primary — §3 layout, §4.1 the 7 next-card priorities), docs/spec/teacher-panel.md §5 + §13,
  docs/spec/leaderboard-and-gamification.md §4 (streak rules), docs/spec/performance.md (dashboard perf budget).

  USER CONTEXT (durable, from memory — don't re-confirm): new to coding (every manual-QA instruction you WRITE must be click-by-click with exact screen text
   / button names / expected output); "choose what's best" is genuine — pick aggressively, summarize defaults in a short table; demo owner
  owner@fynestudy.example.com / FyneStudy01 / TOTP-enrolled (project_demo-owner.md).

  WORKING PROTOCOL:
  1. TaskCreate/TaskUpdate from the start — one task per checkpoint (CP1…CP13) — keep current.
  2. Supabase MCP for ALL DB work (list_migrations, apply_migration, execute_sql, get_logs, get_advisors). Run get_advisors after every DDL change and
  resolve every NEW lint your migration introduces (search_path on trigger/security-definer fns per D-166; multiple_permissive_policies WARN is the accepted
   project-wide pattern — don't fight it). For edge-fn deploys use the D-170 temp-workdir CLI method (copy scripts/stage-phase7-deploy.cjs, swap the fn
  list).
  3. Verify by SQL, never by eye (feedback_supabase-verify-by-sql): counts via information_schema / pg_*.
  4. Bash for repo-local commands. Use sub-agents (Explore / general-purpose) for broad reads so you don't bloat context.
  5. Add automated tests in the Phase 5–7 pattern: pure-TS unit (scripts/test-*.ts → `pnpm test:*`), RLS smoke (smoke-test-*-rls.ts → `pnpm smoke:*-rls`),
  edge-fn HTTP smoke (smoke-test-*-edge-fns.ts → `pnpm smoke:*-fns`), wired into root package.json. Cover rolling-N math, IST streak boundaries, idempotent
  recompute, RLS scoping, and dashboard fn perf (EXPLAIN ANALYZE < 100ms server-side per AC).
  6. NEVER commit, push, --no-verify, --force, branch, or open a PR. NO auto-accept. Before any /compact, persist cross-conversation state to memory +
  update MEMORY.md.

  HARD RULES specific to Phase 8:
  - Mastery = rolling average of the LAST N=5 attempts per (student, topic) (D-070), pooling quiz + exam attempts. Offline scores feed mastery at SUBJECT
  level only, NOT per-topic (phase-8.md §5.3).
  - Streak = "active day" rule (any qualifying action inserts activity_days); NO streak freezes (D-140 rejected). All date math AT TIME ZONE 'Asia/Kolkata'
  (IST midnight boundary).
  - mastery-recompute + streak-recompute MUST be idempotent (D-106): running twice in a day must not double-tick a streak or double-count mastery — use a
  last-evaluated guard.
  - Replace the no-op mastery feeder stubs: inline the per-(student, touched-topics) recompute SQL at the END of quiz-submit AND exam-submit,
  fire-and-forget (must NOT block or fail the user-facing submit). The standalone mastery-recompute edge fn is for the nightly cron sweep + admin full
  re-runs.
  - student_dashboard(student_id) and teacher_dashboard(teacher_id) are single security-definer SQL fns returning one jsonb (set search_path = public;
  coalesce every slice so new/empty users render zeros, not nulls). Client caches 60s + realtime-invalidates on sessions/attendance. Target p95 < 200ms
  server-side.
  - pg_cron: streak-recompute 02:00 IST (20:30 UTC), mastery sweep 02:30 IST (21:00 UTC). Every cron job has an idempotency guard (D-106). Invoke edge fns
  via pg_net (or inline SQL wrapper).
  - Dashboard perf budget (CLAUDE.md): cold-load ≤ 3s on Redmi 8A; FlatList for any list > 20; expo-image with explicit dims; unsubscribe realtime on
  unmount; React.memo on dashboard cards.
  - All Phase 1–7 hard rules still apply (RLS on every user-data table, edge-fn is_active gate, audit_log on admin writes,
  private.is_admin()/has_role()/current_app_user_id() per D-146, withTimeout on mobile fetches per D-148/D-154).

  PHASE 8 SCOPE (phase-8.md is authoritative):
  - DB: mastery + streaks tables + RLS, student_dashboard() + teacher_dashboard() SQL fns, pg_cron schedules.
  - Edge fns: real mastery-recompute + streak-recompute (replace stubs); inline feeders into quiz-submit + exam-submit; activity_days insert on
  attendance-qr-verify.
  - Mobile student: rebuild (student)/index.tsx (NextCard, StatsStrip, TodaySchedule, WeakTopics, ContinueWatching, RecentBadges-empty), streak modal,
  profile mastery tab. Also swap the (student)/classes.tsx Phase-0 placeholder (Phase 7 carry-over) for the real sessions+exams feed.
  - Mobile teacher: rebuild (teacher)/index.tsx (NextCard, PendingList, TodayClasses, QuickActions) + (teacher)/batch/[id].tsx (attendance heatmap,
  topic-mastery bars, at-risk list). Optionally consolidate the crowded 8-tab teacher bar (Quizzes+Exams → one "Tests" tab — Phase 7 carry-over; phase-8.md
  §6.4 hints) — make the call and note it.
  - "Rank: —" placeholder until Phase 10. Badges empty until Phase 10.

  PHASE 7 CARRY-OVERS landing in Phase 8: real mastery-recompute wiring (the TODO stub in exam-submit/quiz-submit) — CP6; swap (student)/classes.tsx
  placeholder; consider the Tests-tab consolidation; Redmi 8A cold-start (hardware-blocked — AC #5 needs it; measure if a device is available, else record
  as hardware-deferred, don't block code-complete). Long-running Phase 1/2 carry-overs (Vercel deploy fix, Sentry+PostHog, leaked-password toggle, app_users
   auth_rls_initplan) are OUT of Phase 8 scope — just don't regress them.

  START: Read everything above, create the CP1–CP13 task list, then BEGIN CP1 immediately and proceed through all checkpoints autonomously (do not pause for
   "go"). Before adding anything, verify current state with list_migrations / Glob / git status so you don't recreate work. Give a one-paragraph "here's the
   plan + starting CP1 now" note, then go.

  Open a fresh conversation and paste that as the first message. When it reports 🟡 CODE-COMPLETE, come back and prompt it for the manual-QA walkthrough
  (same way we did Phase 7). 🚀