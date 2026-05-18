# temp.md — stale debug fragment

> ⚠️ **Stale.** This file held a one-off resume hint from a Phase 1 CP4 debug session (Expo Metro LAN-IP issue). Kept here only so the historical reference doesn't 404 from any link that might exist somewhere.
>
> The underlying issue (iPhone Expo Go can't reach Metro on Wi-Fi) was permanently fixed by `scripts/dev.js` auto-detecting the LAN IP and exporting it as `REACT_NATIVE_PACKAGER_HOSTNAME`. See [Phase 1 ledger §13 — "Deliberate deviations from the original Phase 1 doc"](phase-1.md#13-acceptance-ledger--closed-2026-05-14), entry #5.
>
> Safe to ignore. Safe to delete if you don't like loose files in the docs tree.


 You are continuing work on FyneStudy — a hybrid coaching-institute OS for JEE/NEET/CUET prep, built as a pnpm monorepo (mobile + admin + Supabase
  backend). Phase 4 (Sessions & Attendance) is IN-FLIGHT — CP1 through CP9 are accepted; CP10 (mobile teacher scan + roster + classes) is the next
  checkpoint to execute.

  REPO: C:\Users\kaust\OneDrive\Desktop\FyneStudyLive
  SUPABASE DEV PROJECT REF: orqwyazvcthgxoadfxfv
  GIT BRANCH: main (Phase 2 + Phase 3 are committed locally as 7780d13/a9a610a; all of Phase 4 CP1-CP9 work is UNCOMMITTED on top — single PR opens AFTER
  Phase 4 ledger is accepted)

  BEFORE WRITING ANY CODE, read these files in this order:

  1. CLAUDE.md (repo root) — hard rules, tech stack, debugging map.
  2. Every file linked from ~/.claude/projects/C--Users-kaust-OneDrive-Desktop-FyneStudyLive/memory/MEMORY.md — read ALL of them. The Phase-4-specific
  memories you must read first:
     - project_phase-4-status.md — exhaustive state of CP1–CP9 (17 migrations, 16 edge fns, 6 new tables with exact column counts, 12 new RLS policies, 4
  new SECURITY-DEFINER RPCs, pg_cron job, Realtime publication, smoke test pass counts, gates, audit_log totals).
     - project_phase-4-decisions.md — implementation patterns locked in across CP1-CP9 (rate-limit RPC shape, edge-fn skeleton, QR token wrapped shape,
  corrected IST math, CDC over Broadcast). These apply to CP10.
     - feedback_supabase-verify-by-sql.md — DURABLE RULE: never count Supabase columns/constraints/policies from `list_tables` output by eye; always run
  `execute_sql` against `information_schema` / `pg_*` and quote the actual integer. The user catches off-by-one miscounts immediately. Applies to advisor
  counts and policy counts too.
     - feedback_step-by-step-verification.md — user is new to coding; every "verify this" must be click-by-click with EXACT URLs/button names/expected
  screen text.
     - feedback_decision-delegation.md — "choose whatever is best" is genuine; pick aggressively, still summarize defaults in a table.
     - feedback_compact-hygiene.md — persist everything cross-conversation-worthy to files+memory before user clears.
  3. docs/phases/phase-4.md §5.6 + §6 (CP10 = "Mobile teacher: scanner + roster") — read end-to-end. Also re-read §10 (Acceptance criteria) and §11 (Test
  plan).
  4. docs/spec/attendance.md §4.3 + §5 + §6 + §7 — teacher scanning + roster + corrections + ad-hoc sessions UX.
  5. docs/spec/teacher-panel.md §7 (Scan QR).
  6. docs/decisions.md D-030 through D-038, D-103, D-115, D-146, D-152, D-153, D-154 — binding constraints.
  7. The already-built backend that CP10 wires up to (read so you wire the mobile against the real edge-fn signatures, not from memory):
     - apps/functions/attendance-qr-verify/index.ts — takes `{ qr_payload, session_id }`; returns `{ status, student_name, attendance_id }` on 200; status
  codes 401/400/403/404/409/429.
     - apps/functions/attendance-correct/index.ts — takes `{ attendance_id, new_status, reason }`; admin OR teacher-in-batch.
     - apps/functions/attendance-bulk-mark/index.ts — takes `{ session_id, mark_remaining: 'present'|'absent' }`; teacher only.
     - apps/functions/session-create-ad-hoc/index.ts — takes `{ batch_id, subject_id?, scheduled_start, scheduled_end, is_live_class? }`; teacher only.
  8. apps/mobile/app/(teacher)/_layout.tsx — teacher tab structure (Home, Scan, Classes, Library, Batch, Profile).
  9. apps/mobile/app/(teacher)/{scan,classes}.tsx — current Phase-0 placeholders to replace.
  10. apps/mobile/app/(student)/attendance.tsx and the 4 hooks in apps/mobile/features/attendance/ — CP9 patterns to mirror (useQrToken polling shape,
  useAttendanceRealtime, etc.).
  11. apps/mobile/features/org/useAssignedBatches.ts — teacher's batch list, already wired (use it for the session picker).

  WORKING PROTOCOL — do not skip any of these:

  1. Use TaskList to see existing tasks. Task #1–#13 exist; #1–#9 are completed; #10 is the next pending. Mark #10 in_progress when you start CP10. Don't
  recreate.
  2. Work through the remaining checkpoints one at a time. At each "STOP. Checkpoint N." in docs/phases/phase-4.md, produce a five-section structured
  summary:
     (a) what was done
     (b) mechanical verification with exit codes / pass counts / SQL quote
     (c) deliberate deviations from the doc + why
     (d) what the user must verify manually — click-by-click with EXACT URLs and EXACT expected screen text
         (https://supabase.com/dashboard/project/orqwyazvcthgxoadfxfv/…)
     (e) what they do NOT need to verify (mechanical proof above is sufficient)
     Then PAUSE and wait for "Checkpoint N OK" before continuing. Never auto-advance.
  3. ALWAYS verify Supabase schema/policy/advisor claims via `execute_sql` first, then quote the integer/string the query returned. NEVER count from
  `list_tables` output by eye. The user lost trust over this in CP1 and re-tested it during the CP1-CP9 verification turn (everything matched).
  4. Never auto-commit. Never push. Never open a PR without explicit "open the PR" approval.
  5. Never auto-accept the phase. After CP13, append §14 Acceptance Ledger to docs/phases/phase-4.md mirroring the format of docs/phases/phase-3.md §14,
  then PAUSE and wait for "Phase 4 accepted".
  6. Use the Supabase MCP for all DB work (apply_migration, execute_sql, deploy_edge_function, list_tables, list_edge_functions, get_advisors). After every
  migration AND every edge-fn deploy, run `get_advisors security` AND `get_advisors performance` and quote the diff vs end of CP9.
  7. Use Bash for repo-local commands (pnpm test:rls, pnpm test:hmac, pnpm -r typecheck, pnpm -r lint, git status). After each CP that touches the mobile
  surface, run typecheck + lint + the existing smoke tests as the mechanical-proof gate.
  8. Use AskUserQuestion at real forks only. Don't ask for trivial choices — the user has explicitly delegated tactical decisions
  (feedback_decision-delegation memory). Pick aggressively.
  9. The user is new to coding (feedback_step-by-step-verification memory). Every "verify this" must be click-by-click with exact URLs, exact button names,
  exact expected screen output.
  10. Before any /compact or session end, save anything cross-conversation-worthy to
  ~/.claude/projects/C--Users-kaust-OneDrive-Desktop-FyneStudyLive/memory/ and update MEMORY.md.

  HARD RULES FROM CLAUDE.md (still in force for CP10):

  - "Mobile-first. Test on a real low-end device (Redmi 8A class) before declaring done." → mobile changes need real-device verification; I can't do it from
   CLI, so explicitly call this out in the (d) section of each CP summary.
  - "Server is the only source of QR validity. Never trust device clock." → server time only.
  - "Every edge function checks `app_users.is_active = true` after JWT verification." → `loadCaller()` does this.
  - "Every admin/teacher write produces an audit_log row with before/after JSON." → already done by the backend; mobile UI just calls the existing fns.
  - "No `console.log` in production builds." → babel strips it but write better. Only `console.error` in edge fns.
  - D-152: when a mobile screen embeds another user's row through a join (e.g., `students.select("user_id, app_users!user_id(full_name)")`), the target
  table needs an RLS policy granting the calling role access — `app_users_teacher_batch_read` (Phase 3 CP10) already covers teacher reading student names
  via embed.
  - D-148: every mobile Supabase data call wraps in `withTimeout(...)` (15s default). Auth calls bump to 30s per D-154.

  CP10 SCOPE (from phase-4.md §6 + spec/attendance.md §4.3 / §5 / §7):

  Build three teacher screens + components + hooks. All wire to existing edge fns (deployed at the end of CP6).

  1. apps/mobile/app/(teacher)/scan.tsx — full rewrite.
     - Uses `expo-camera` `CameraView` with `barcodeScannerSettings.barcodeTypes = ['qr']`.
     - Session picker at the top (defaults to nearest live / upcoming session in teacher's assigned batches).
     - On QR scan → call `attendance-qr-verify` edge fn with `{ qr_payload: <scanned>, session_id: <picked> }`.
     - Success → emerald toast + success haptic (`expo-haptics`); message "✔ {student_name} — {status}".
     - 4xx errors → red toast with reason mapped from status code:
       • 401 (bad sig) → "QR signature invalid"
       • 400 expired → "QR expired — ask student to refresh"
       • 400 sid mismatch → "QR belongs to a different class"
       • 400 scan-closed → "Scan window closed for new entries"
       • 403 → "Not authorized for this batch"
       • 409 → "Already marked"
       • 429 → "Slow down — too many scans"
     - Continues scanning after each result (sequential mode); rate-limit-aware (don't fire calls within 500ms — server enforces 2/s).
     - Camera permission denied → friendly fallback screen with `Linking.openSettings()` deep link.
     - Switch-to-Roster button.

  2. apps/mobile/app/(teacher)/roster/[sessionId].tsx — new file.
     - Loads students in the session's batch + their attendance via service-role through PostgREST + RLS.
     - Each row shows three pills: P (Present) / L (Late) / A (Absent). Tapping a pill calls `attendance-correct` if there's an existing row, or just
  inserts via `attendance-bulk-mark` for the single student (or use a small dedicated mark endpoint — pick & document).
     - "All Present" and "All Absent" buttons at the top → confirmation dialog → call `attendance-bulk-mark`.
     - Long-press a student row → "Change status…" sheet with reason field; calls `attendance-correct`.
     - D-152 reminder: the `students.select("user_id, app_users!user_id(full_name)")` embed pattern relies on `app_users_teacher_batch_read` RLS — already
  in place.

  3. apps/mobile/app/(teacher)/classes.tsx — full rewrite.
     - Segmented control: Today / Upcoming / Past.
     - Each row → link to /scan?session=<id> or /roster/<id> based on a row-level button.
     - "+" FAB → "New Ad-hoc Class" sheet → calls `session-create-ad-hoc`.

  Shared components (new):
  - apps/mobile/components/teacher/ScannerOverlay.tsx — bracket frame + scan line.
  - apps/mobile/components/teacher/RosterRow.tsx — student row with P/L/A pills.
  - apps/mobile/components/teacher/AdhocSheet.tsx — bottom sheet for new ad-hoc session.

  Hooks (new in apps/mobile/features/attendance/):
  - useScanVerify.ts — fires `attendance-qr-verify`, handles all the status codes, rate-limits client-side too.
  - useRoster.ts — loads roster + attendance for a session; subscribes to Realtime for live updates.
  - useTeacherSessions.ts — today/upcoming/past for the teacher's assigned batches.
  - useCameraPermission.ts — wraps `expo-camera` `useCameraPermissions` + denial UX.

  After mobile work:
  - Run `pnpm -r typecheck` + `pnpm -r --if-present lint` + the existing CP4-CP8 smoke tests (no new edge fn — CP10 is mobile-only; no advisors change).
  - Real-device test: not doable from CLI. Call this out in (d) of the CP10 summary.

  CARRY-OVERS / KNOWN ISSUES TO BE AWARE OF:

  - Realtime cold-start flake: first subscriber after worker idle takes ~30s; subsequent <100ms. `pnpm smoke:realtime` may fail on the first run after a
  long pause — second run lands instantly. Use two students in any new smoke that needs to insert attendance twice (the UNIQUE constraint on (session_id,
  student_id) blocks back-to-back inserts for the same pair).
  - One unindexed_foreign_keys INFO on `qr_sign_attempts.student_id_fkey` — composite PK leads with session_id, so student_id alone is uncovered. Access
  pattern always uses the full PK. Accepted INFO (would just spawn unused_index if we added a single-column index).
  - CP9 real-device verification still deferred — user can step through the 5-tier guide before committing.
  - 1 security WARN (`auth_leaked_password_protection`) is a Phase 1 backlog item, not new.
  - `cp6-student-1-*` and similar fixture students exist in the DB from prior smoke runs. They have generated random passwords (not in any committed file).
  If user wants to log in as a student manually, write a `pnpm seed:manual-test` script that bootstraps a known-password test student + an in-window
  session.

  GENERAL APPROACH after CP10:
  - CP11 = mobile student dashboard `(student)/index.tsx` real-data wiring — replace Phase-0 mock content with today's schedule + attendance %.
  - CP12 = admin `/attendance` Next.js page — filters, table, corrections modal, CSV export. Mirror Phase 3 admin patterns from
  apps/admin/app/(dashboard)/{batches,courses,teachers}.
  - CP13 = §14 Acceptance Ledger. Mirror docs/phases/phase-3.md §14 exactly: AC results table (21 ACs from §10), mechanical proof corpus, DoD checklist,
  deliberate deviations, carry-overs into Phase 5, Phase-3-vs-Phase-4 comparison table. Then PAUSE.

  START: Run TaskList to confirm task state. Read CLAUDE.md and the two phase-4 memories. Then say "Ready to start Phase 4 CP10." with a one-paragraph plan
  of CP10's scope drawn from the SCOPE block above and docs/phases/phase-4.md §6. Then PAUSE and wait for "go". Do NOT re-do any CP1–CP9 work — all of it is
   on disk, verified, and the database state matches the memory exactly (re-verified at the end of the previous session: 17 migrations, 16 edge fns, 0
  tables without RLS, 1 cron job, 1 realtime table, 1 vault secret, 208 audit_log rows, Phase 4 column counts activity_days=2 attendance=9
  attendance_corrections=7 qr_sign_attempts=3 qr_verify_attempts=2 sessions=14).

  If anything in `project_phase-4-status.md` doesn't match what `mcp__claude_ai_Supabase__list_migrations` returns when you check, STOP and tell the user
  before proceeding — the memory might have drifted and we need to resync.


































 RESUME PHASE 4 — FYNESTUDY MOBILE/BACKEND

  I'm continuing from a prior session where you implemented Phase 4 CP10 (mobile teacher: scan + roster + classes). All code on disk is verified
   correct, all gates green. The only thing left is for me to walk through the manual verification on my phone, then advance to CP11, CP12,
  CP13.

  BEFORE READING THIS PROMPT FURTHER, do these in order:
  1. Read C:\Users\kaust\.claude\projects\C--Users-kaust-OneDrive-Desktop-FyneStudyLive\memory\MEMORY.md
  2. Read the file linked there as "Phase 4 status" — that's the current state of CP10 (status: code-verified, pending real-device walkthrough).
  3. Read the file linked as "Phase 4 decisions" — that has D-156/D-157/D-158 which are binding decisions for CP10–CP13.
  4. Read the file linked as "Metro stale-bundle gotcha" — explains why hot-reload won't fix layout-tree changes.
  5. Read CLAUDE.md (repo root) for hard rules and tech stack.
  6. Run TaskList — you'll see #1 CP10 marked completed, #2/#3/#4 pending. Don't recreate.
  7. Run `git status --short` to confirm uncommitted Phase 4 work is on disk.

  THE PLAN FOR THIS SESSION:

  Step A — Help me verify CP10 on real device.
  Step B — Once I say "Checkpoint 10 OK", advance to CP11.
  Step C — Then CP12, then CP13 (acceptance ledger), then pause for "Phase 4 accepted".

  == STEP A: CP10 manual verification ==

  Before I do anything on the phone, do these from CLI:

  A1. Run `pnpm seed:manual-test` and PASTE the output back to me. The previous seed credentials are aged past their scan window by now (they
  were valid Sun 17 May 03:39–05:44 IST). The new seed gives me a fresh open-now session + teacher + 2 students with random passwords printed.

  A2. Verify the database state matches the memory exactly. Use mcp__claude_ai_Supabase__execute_sql with this query and quote the integers back
   to me:
     select (select count(*)::int from public.audit_log) as audit_total,
            (select count(*)::int from public.audit_log where action='attendance_manual_marked') as manual_marked,
            (select count(*)::int from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and
  tablename='attendance') as realtime_attendance,
            (select count(*)::int from pg_tables where schemaname='public' and rowsecurity=false) as tables_without_rls,
            (select count(*)::int from cron.job where active and jobname='materialize-sessions-nightly') as cron_active;

  A3. Run mcp__claude_ai_Supabase__list_edge_functions and confirm 17 functions present including attendance-manual-mark v1.

  A4. Run mcp__claude_ai_Supabase__get_advisors security AND performance — should be 1 security WARN + 28 performance lints (same as end of
  CP9).

  A5. Confirm git diff HEAD on apps/mobile/app/_layout.tsx AND apps/mobile/app/(teacher)/_layout.tsx — BOTH should be EMPTY (zero diff vs Phase
  3 HEAD). This is critical — D-157 locks this.

  Then give me the FULL manual test plan as a numbered checklist. I will run through it on my phone (iOS, Expo Go). For each step I'll either
  say "step N passed" or describe what I saw. The plan must include:

  1. METRO CLEAN RESTART procedure first, with EXACT commands:
     - In the terminal where Metro is running, Ctrl+C
     - Force-quit Expo Go on phone (swipe away in recents, do not just relaunch)
     - Run: pnpm --filter @fynestudy/mobile exec expo start --clear
     - Reopen Expo Go from home icon (not recents)
     - Scan the new QR
     - Confirm bundle line reads "(NNNN modules)" with N in thousands, NOT "(1 module)"
     - Note: this is non-negotiable per [[metro-stale-bundle]] memory.

  2. Sign in as Teacher (use the credentials from A1's seed output). Expected: lands on teacher Home tab. Bottom bar shows 6 tabs: Home / Scan /
   Classes / Library / Batch / Profile. NO Roster tab.

  3. Tap Scan tab. Allow camera permission. Verify camera preview opens with:
     - Top dark banner: "SCANNING FOR" + subject/time/batch (the open-now session from A1)
     - Centre: 240px square with yellow corner brackets
     - Caption pill: "Point at student's QR"
     - Bottom button: "Open roster"

  4. Tap the top banner. Dropdown shows both sessions (Today open-now + Upcoming tomorrow). Tap Upcoming, banner updates, tap banner again, pick
   Today.

  5. Tap Classes tab. Verify:
     - Title "Your schedule"
     - Segmented Today/Upcoming/Past with counts
     - Today selected, one card visible with Scan/Roster buttons + "0 / 2 marked" badge
     - Tap Upcoming → shows tomorrow's session
     - Tap Past → "No recent classes" empty state

  6. Back on Classes (Today), tap the blue + FAB. Bottom sheet "New ad-hoc class" appears.
     - Batch picker preselected to Manual Test batch
     - Duration chips: 30 / 45 / 60 (selected) / 90 min
     - Starts card shows next 15-min IST mark
     - Tap 90 min → end time updates
     - Tap "Create class" → sheet closes, navigates to roster of new session

  7. On the roster screen (auto-arrived from step 6 OR tap Roster from any session row):
     - Header: "Roster" + back arrow
     - Info card: batch + subject + time range
     - Count chips: 0 Present, 0 Late, 0 Absent, 2 Pending
     - Buttons: "All Present" (green), "All Absent" (red)
     - 2 student rows alphabetical (Test Student One / Test Student Two), each with initials avatar, name, "Unmarked" label, 3 round pills P/L/A
     - Tap P on first student → pill turns solid green, label flips to "manual", counters update (1 Present / 1 Pending)
     - Tap A on the same student → bottom sheet "Change status — Test Student One" opens, ABSENT preselected red, reason chips visible
     - Tap "Teacher error" chip + Save → sheet closes, row's A pill solid red, label says "correction"
     - Long-press the second student row → Alert "Not marked yet" (correct — long-press requires existing row)
     - Tap L on second student → pill turns amber
     - Tap "All Absent" → confirm dialog says 0 unmarked → Cancel
     - Tap back arrow → returns to Classes

  8. Test camera-denied fallback:
     - Phone Settings → Apps → Expo Go → Permissions → Camera → Deny
     - Return to app, tap Scan tab
     - Expected gray screen with amber camera icon, "Camera access needed" header, body text, "Open Settings" black button
     - Tap "Open Settings" → deep-links to phone's app-settings page
     - Re-enable camera, return

  9. (Optional — needs 2 devices) Two-device QR scan flow:
     - Device A: sign in as Student 1 (creds from A1), open Attendance tab → see rotating QR for the open session
     - Device B: still teacher, Scan tab, picker on the open-now session, point at Device A's screen
     - Expected: ~1s later — vibrate, green overlay, green toast "✔ Test Student One — Marked present", Device A flips to "You're marked!"
     - Scan same QR again → red toast "Already marked"
     - Switch Device B picker to tomorrow's session, scan Device A's QR → red toast "Wrong class"

  After I report back, run this SQL via execute_sql to verify the database matches what I did on the phone:
    select s.scheduled_start, count(a.id)::int as marked_count,
           array_agg(a.status order by a.marked_at) as statuses,
           array_agg(a.method order by a.marked_at) as methods
    from public.sessions s
    left join public.attendance a on a.session_id = s.id
    where s.batch_id = '<paste batch_id from A1 output>'
    group by s.id, s.scheduled_start
    order by s.scheduled_start;

  If everything checks out, mark CP10 task completed (it's already completed in TaskList — just confirm), then PAUSE and wait for me to say
  "Checkpoint 10 OK".

  == STEP B: CP11 — Mobile student dashboard wiring ==

  After Checkpoint 10 OK:
  - Mark task #2 in_progress.
  - Read docs/phases/phase-4.md §6 "Mobile dashboard partial wiring (Checkpoint 11)".
  - Replace Phase-0 mock content in apps/mobile/app/(student)/index.tsx with:
    - Greeting + streak placeholder ("0 — coming in Phase 8")
    - Today's Schedule from useTodaySessions (already exists from CP9)
    - Stats strip with Attendance % computed from useAttendanceHistory (already exists from CP9) — reuse, don't refetch
  - No new edge fn, no DB change.
  - Gates: pnpm -r typecheck + pnpm --filter @fynestudy/mobile lint.
  - Produce the 5-section structured CP11 summary (a/b/c/d/e). Section (d) needs the same Metro restart caveat. PAUSE for "Checkpoint 11 OK".

  == STEP C: CP12 — Admin /attendance page ==

  After Checkpoint 11 OK:
  - Mark task #3 in_progress.
  - Read phase-4.md §6 "Admin attendance page (Checkpoint 12)".
  - Build apps/admin/app/(dashboard)/attendance/page.tsx:
    - Filters: date range, batch
    - Table: rows = students, cols = sessions, cells = status (P/L/A)
    - Click cell → correction modal calling attendance-correct
    - CSV export via Blob + URL.createObjectURL
  - Mirror Phase 3 admin patterns from apps/admin/app/(dashboard)/{batches,courses,teachers}.
  - Use withAudit wrapper for the correction action.
  - Gates: pnpm -r typecheck + pnpm --filter @fynestudy/admin lint.
  - Produce the CP12 5-section summary. PAUSE for "Checkpoint 12 OK".

  == STEP D: CP13 — Phase 4 §14 acceptance ledger ==

  After Checkpoint 12 OK:
  - Mark task #4 in_progress.
  - Append §14 to docs/phases/phase-4.md mirroring docs/phases/phase-3.md §14 format:
    - AC results table (21 ACs from phase-4.md §10)
    - Mechanical proof corpus (typecheck, lint, all smoke counts)
    - DoD checklist
    - Deliberate deviations (D-156, D-157, D-158, plus all earlier P4 decisions)
    - Carry-overs into Phase 5
    - Phase-3-vs-Phase-4 comparison table
  - Do NOT auto-accept. PAUSE for "Phase 4 accepted".

  == AT THE END ==

  After "Phase 4 accepted":
  - Update project_phase-4-status.md to closed.
  - Note "open the PR" requires explicit approval.
  - Do NOT commit or push without my OK.

  == GROUND RULES FOR THIS SESSION ==

  - Never auto-commit. Never push. Never open a PR without "open the PR" from me.
  - Verify Supabase claims by SQL, not by eye (memory: supabase-verify-by-sql).
  - Step-by-step verification with exact URLs / button names / expected screen text (memory: step-by-step-verification).
  - If I report an RN error after a code fix, FIRST suspect stale Metro bundle (memory: metro-stale-bundle). Quote the "(N module)" bundle line
  as evidence before adding more fixes.
  - After each CP, produce a 5-section structured summary (a) what was done (b) mechanical verification with exit codes/pass counts/SQL quote
  (c) deliberate deviations (d) manual click-by-click verification I must do (e) what I do NOT need to verify.

  Begin with Step A1 (re-seed) and A2–A5 (DB state recheck). Then give me the manual test checklist. Then PAUSE for my walkthrough.














---



































 RESUME PHASE 4 — FYNESTUDY MOBILE/BACKEND (post-session, 2026-05-18 carry-over)

  State summary (read memory before doing anything else):
  - Phase 4 backend (CP1–CP8) accepted in earlier sessions.
  - CP9 mobile student attendance code accepted; §A manual tests PASSED 2026-05-18.
  - CP10 mobile teacher scan + roster + classes code accepted; §B manual tests PASSED
    2026-05-18 single-phone (B12 camera-denied probably-fine, B13/B14/B15 two-device
    deferred, B16 Realtime tick deferred).
  - CP11 mobile student dashboard wiring code-complete, §C manual tests STILL PENDING.
  - CP12 admin /attendance page code-complete, §D manual tests STILL PENDING.
  - §E performance tests STILL PENDING (E1 needs Redmi 8A hardware — known carry-over).
  - CP13 (acceptance ledger) is HELD until §C/§D/§E pass AND the 7 new fixes from
    2026-05-18 (D-159…D-165) are written into docs/phases/phase-4.md §14.
  - ALL Phase 4 work is uncommitted on `main`. NO PR is open.

  BEFORE READING THIS PROMPT FURTHER, do these in order:
    1. Read C:\Users\kaust\.claude\projects\C--Users-kaust-OneDrive-Desktop-FyneStudyLive\memory\MEMORY.md
    2. Read "Phase 4 status" (project_phase-4-status.md) — current state of CP1–CP13.
    3. Read "Phase 4 manual tests pending" (project_phase-4-manual-tests-pending.md) — §C/§D/§E plan.
    4. Read "Phase 4 decisions" (project_phase-4-decisions.md) — D-148 through D-165 binding rules.
    5. Read "Expo monorepo singleton dedup" (feedback_expo-monorepo-dedup.md) — non-obvious infra fix from last session.
    6. Read "css-interop bypass for freezes" (feedback_cssinterop-bypass.md) — non-obvious render fix from last session.
    7. Read "Metro stale-bundle gotcha" (feedback_metro-stale-bundle.md) — restart procedure.
    8. Read CLAUDE.md (repo root) for hard rules.
    9. Read docs/phases/phase-4-manual-tests.md cover-to-cover — the gating doc, especially §C, §D, §E sections.
    10. Run `git status --short` to confirm Phase 4 work is still uncommitted.

  ABOUT ME
  - I'm kaustab, new to coding. Walk me through everything click-by-click: exact button
    names, exact URLs, exact expected screen text. Don't just say "go to the Profile tab" —
    say "tap the silhouette icon in the bottom bar, 5th from left, labelled Profile".
  - I trust your judgment on architecture / patterns. When you say "I recommend X", I
    usually go with it. But VERIFY before recommending — read the current code, run SQL,
    don't rely on memory alone for facts that might have moved.
  - I'll usually ask for ultrathink on hard problems. Use it.

  WHAT WE'RE DOING
  - FyneStudy is a coaching-institute OS (JEE/NEET/CUET prep). One mobile app
    (RN + Expo SDK 54), one admin web (Next.js 15), one Supabase backend.
  - Phase 4 is "Sessions & Attendance" — rotating-QR attendance, ad-hoc classes,
    teacher roster, corrections, admin matrix. See CLAUDE.md "Module Map" row
    Attendance for the spec/route/edge-fn map.
  - I'm in the middle of phased delivery. After Phase 4 I'll continue with 5, 6, etc.
  - Phase 4 acceptance is gated on docs/phases/phase-4-manual-tests.md sections §A–§E.

  WORKFLOW RULES
  - Section-by-section through the manual test plan. Quote the section header to me.
    Re-state the click-by-click steps inline so I don't have to cross-reference the doc.
    Wait for "section X.N passed" or "failed — <description>" before moving on.
  - On UI failure: FIRST hypothesise stale Metro bundle ([[metro-stale-bundle]]).
    Then css-interop false-positive ([[cssinterop-bypass]]) if the freeze pattern matches.
    THEN investigate real code bug.
  - Verify Supabase claims by SQL (execute_sql), not by eye.
  - After each passing section, 1-line "§X done. Next: §Y." update — no long summaries.
  - NEVER auto-commit, NEVER push, NEVER open a PR without me explicitly saying
    "open the PR" or "commit this". Auth for one git action does NOT carry to others.

  WHAT'S BEEN DONE — DO NOT REDO
  - CP1–CP8 backend (migrations, RLS, HMAC, qr-sign/verify, correct/bulk-mark/ad-hoc,
    materialize, realtime publication).
  - CP9 mobile student attendance + §A manual tests.
  - CP10 mobile teacher scan/roster/classes + §B manual tests (single-phone subtests).
  - CP11 mobile student dashboard wiring (apps/mobile/app/(student)/index.tsx —
    greeting + streak placeholder + real Today's Schedule + Attendance % + "More coming
    soon"). Code accepted; §C manual tests pending.
  - CP12 admin /attendance page (apps/admin/app/(dashboard)/attendance/* + nav entry).
    Code accepted; §D manual tests pending.
  - 7 fixes from 2026-05-18 session (must land in CP13 ledger):
     D-159 Metro singleton dedup (apps/mobile/metro.config.js — react, react-dom,
           react-native, expo-modules-core via resolveRequest)
     D-160 <CameraView> as absoluteFill sibling (apps/mobile/app/(teacher)/scan.tsx)
     D-161 react-native-css-interop@0.2.3 stringify patch (patches/ + pnpm.patchedDependencies in root package.json)
     D-162 Past-tab empty state uses plain style props (apps/mobile/app/(teacher)/classes.tsx)
     D-163 useAssignedBatches inner-joins batch_teachers (apps/mobile/features/org/useAssignedBatches.ts)
     D-164 Roster pill UX: 48×48 + hitSlop=6 + tap-active-toggles-to-unmarked (RosterRow.tsx + roster/[sessionId].tsx)
     D-165 New edge fn attendance-unmark (apps/functions/attendance-unmark/, deployed v1 ACTIVE)
  - 18 edge functions total now (was 17 — added attendance-unmark).

  DO NOT rewrite, refactor, or "polish" any of the above. The code is correct on disk.

  THE PLAN FOR THIS SESSION

  Step 0 — Re-orient (run in parallel).
    0a. `pnpm seed:manual-test` → paste the new credentials back to me. Old fixtures
        are way past their open window.
    0b. mcp__claude_ai_Supabase__execute_sql with this counts query:
          select (select count(*)::int from public.audit_log) as audit_total,
                 (select count(*)::int from public.audit_log where action='attendance_unmarked') as unmarked,
                 (select count(*)::int from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='attendance') as
  realtime_attendance,
                 (select count(*)::int from pg_tables where schemaname='public' and rowsecurity=false) as tables_without_rls,
                 (select count(*)::int from cron.job where active and jobname='materialize-sessions-nightly') as cron_active;
        Confirm tables_without_rls=0, realtime_attendance=1, cron_active=1.
    0c. mcp__claude_ai_Supabase__list_edge_functions — confirm 18 ACTIVE including attendance-unmark.
    0d. `git status --short` — work still uncommitted on main, no surprises.
    0e. `git diff HEAD -- apps/mobile/app/_layout.tsx apps/mobile/app/'(teacher)'/_layout.tsx`
        — both still ZERO diff vs HEAD (D-157 lock).
    0f. Quick read of apps/mobile/metro.config.js + patches/react-native-css-interop@0.2.3.patch
        to confirm the singleton dedup and css-interop patch are in place.
    0g. Once 0a–0f are green: "Backend still solid. Re-seeded creds: <paste>. Ready to
        walk §C."

  Step A — §C — CP11 student dashboard (6 sub-tests, phone-driven).
    - Sign out from current Teacher session (Profile tab → Sign out).
    - Sign in as Student 1 from the freshly-re-seeded creds.
    - Walk C1 → C6 per docs/phases/phase-4-manual-tests.md §C.
    - On failure: stale-bundle hypothesis first, then code.

  Step B — §D — CP12 admin /attendance browser (8 sub-tests).
    - Owner admin: owner@fynestudy.example.com + TOTP I have.
    - URL: https://admin-kohl-sigma.vercel.app/  (if still Phase-1 placeholder, fall back to
      `pnpm --filter @fynestudy/admin dev` and http://localhost:3000/).
    - Walk D1 → D8. D8 is an SQL audit-trail check you can do entirely via execute_sql once
      I've done D4.

  Step C — §E — Performance (4 sub-tests).
    - E1 cold-start needs Redmi 8A class device — I don't have one, accept the carry-over.
    - E2/E3/E4 doable on iPhone — sanity not strict.

  Step D — Only after §C/§D/§E pass (or are explicitly deferred), move to CP13.
    - Mark task #4 (CP13) in_progress.
    - Read docs/phases/phase-3.md §14 to mirror its shape.
    - Append §14 to docs/phases/phase-4.md with:
        • AC results table (all 21 ACs from phase-4.md §10, with pass/fail + covering section).
        • Mechanical proof corpus (typecheck, lint, smoke counts — copy from
          [[phase-4-status]] + this session's fresh runs).
        • DoD checklist (§13).
        • Deliberate deviations: D-115, D-148, D-152, D-153, D-154, D-156, D-157, D-158,
          D-159, D-160, D-161, D-162, D-163, D-164, D-165.
        • Doc-vs-code fixes uncovered during §A/§B:
            • §A3 wording: "Scan window is closed." (code) vs "No live class right now" (doc)
            • §A4: no calendar heatmap modal in code — inline history is the actual feature
            • §B7/B8: roster pills now 48×48 with toggle-to-unmark via attendance-unmark fn
        • Carry-overs into Phase 5: Vercel deploy fix, Sentry+PostHog, Android cold-start
          hardware, two-device QR race tests (B13–B15), Realtime tick observation (B16),
          16 perf advisor INFOs, auth_leaked_password Phase 1 backlog.
        • Phase-3-vs-Phase-4 comparison table.
    - DO NOT commit or auto-accept. PAUSE for "Phase 4 accepted".

  Step E — After "Phase 4 accepted":
    - Update project_phase-4-status.md memory to CLOSED.
    - Wait for "open the PR" before any git commit / push / gh pr create.

  GROUND RULES (same as last session)
  - NEVER auto-commit. NEVER push. NEVER open a PR without explicit "open the PR" from me.
  - Verify Supabase claims by SQL, not by eye ([[supabase-verify-by-sql]]).
  - Step-by-step verification with exact URLs / button names / expected screen text ([[step-by-step-verification]]).
  - If I report an RN error after a code fix, FIRST suspect stale Metro bundle ([[metro-stale-bundle]]). Quote the "(N module)" bundle line as evidence
  before adding more fixes.
  - Then check [[cssinterop-bypass]] if the symptom is a freeze on a static subtree.
  - Then check [[expo-monorepo-dedup]] if the symptom is "Invalid hook call" or "View config getter callback".

  Begin with Step 0a (re-seed) and Step 0b–0f (state recheck) IN PARALLEL — they're independent. Once that's reported, ask me whether I want to start with
  §C (likely yes).