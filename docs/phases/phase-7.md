# Phase 7 — Graded Exams

> Teacher-scheduled, server-timed, hard-cut MCQ tests. Synchronized start, tab-switch logging, teacher-released results, regrade with audit, offline test scores. Reuses the question bank from Phase 6.

---

## 1. Goal

The first high-stakes feature. Server is the authoritative source for time and scoring. The mobile attempt UI is locked-down (no Reanimated, no animations, no decorations). Teachers manage everything else from their phones.

## 2. Prerequisites

- [ ] Phase 6 accepted.
- [ ] Question bank populated.
- [ ] Decision on tab-switch policy: log + warn, no auto-submit (D-055).
- [ ] Decision on results: manual release by teacher (D-056), default; instant allowed.

## 3. Scope

### In
- DB: `exams`, `exam_questions`, `exam_attempts`, `exam_answers`, `offline_test_scores`.
- Edge functions: `exam-start`, `exam-tab-switch`, `exam-submit`, `exam-release-results`, `exam-regrade`, `offline-score-upsert`, `server-time`.
- Mobile student: `(student)/exam/[id].tsx` locked-down attempt UI; pre-exam countdown; post-submit waiting / result.
- Mobile teacher: `(teacher)/exam-builder.tsx`, `(teacher)/exam/[id]/results.tsx`, `(teacher)/offline-scores.tsx`.
- Server-time sync helper.
- Question snapshot: exam attempt pins question + option content at start (so teacher edits mid-window don't affect in-progress attempts).
- Admin: `/exams` (cross-batch oversight + manual release override).

### Out
- Webcam proctoring.
- Subjective/long-answer.
- OMR scan (D-144 deferred).
- Multi-section exams.

## 4. Specs in play

- `docs/spec/examinations.md` — primary.
- `docs/spec/security.md §13` (server-time sync).
- `docs/spec/performance.md §5.3` (exam screen perf rules).
- `docs/decisions.md` D-052, D-055, D-056, D-059.

## 5. Backend work

### 5.1 Migration: exams + offline scores (Checkpoint 1)

`supabase/migrations/0015_exams.sql`:

```sql
create table public.exams (
  id                  uuid primary key default gen_random_uuid(),
  title               text not null,
  batch_id            uuid not null references public.batches(id) on delete cascade,
  starts_at           timestamptz not null,
  duration_min        int not null check (duration_min between 1 and 360),
  marks_correct       numeric not null default 4,
  marks_wrong         numeric not null default -1,
  marks_skip          numeric not null default 0,
  randomize_questions boolean not null default true,
  randomize_options   boolean not null default true,
  result_release      text not null default 'manual' check (result_release in ('instant','manual')),
  results_released_at timestamptz,
  is_published        boolean not null default false,
  created_by          uuid not null references public.app_users(id),
  created_at          timestamptz not null default now()
);

create index exams_batch_starts_idx on public.exams (batch_id, starts_at);

create table public.exam_questions (
  exam_id     uuid not null references public.exams(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete restrict,
  sort_order  int not null default 0,
  primary key (exam_id, question_id)
);

create table public.exam_attempts (
  id               uuid primary key default gen_random_uuid(),
  exam_id          uuid not null references public.exams(id) on delete cascade,
  student_id       uuid not null references public.students(user_id) on delete cascade,
  started_at       timestamptz not null default now(),
  submitted_at     timestamptz,
  auto_submitted   boolean not null default false,
  tab_switch_count int not null default 0,
  score            numeric,
  max_score        numeric,
  question_snapshot jsonb not null,  -- pinned content at start
  unique (exam_id, student_id)
);

create table public.exam_answers (
  attempt_id         uuid not null references public.exam_attempts(id) on delete cascade,
  question_id        uuid not null references public.questions(id) on delete restrict,
  selected_option_id uuid references public.question_options(id),
  is_flagged         boolean not null default false,
  answered_at        timestamptz,
  primary key (attempt_id, question_id)
);

create table public.offline_test_scores (
  id          uuid primary key default gen_random_uuid(),
  batch_id    uuid not null references public.batches(id) on delete cascade,
  student_id  uuid not null references public.students(user_id) on delete cascade,
  test_name   text not null,
  test_date   date not null,
  subject_id  uuid references public.subjects(id),
  score       numeric not null check (score >= 0),
  max_score   numeric not null check (max_score > 0),
  notes       text,
  entered_by  uuid not null references public.app_users(id),
  entered_at  timestamptz not null default now()
);
```

### 5.2 Migration: exam RLS (Checkpoint 2)

`supabase/migrations/0016_exams_rls.sql`:

```sql
alter table public.exams enable row level security;
alter table public.exam_questions enable row level security;
alter table public.exam_attempts enable row level security;
alter table public.exam_answers enable row level security;
alter table public.offline_test_scores enable row level security;

-- Exams: student of batch reads published; teacher of batch reads all; admin all.
create policy exams_student on public.exams for select to authenticated
  using (
    is_published = true
    and batch_id = (select batch_id from public.students where user_id = public.current_app_user_id())
  );

create policy exams_teacher on public.exams for select to authenticated
  using (
    public.has_role('teacher')
    and batch_id in (select batch_id from public.batch_teachers where teacher_id = public.current_app_user_id())
  );

create policy exams_teacher_write on public.exams for all to authenticated
  using (public.has_role('teacher') and batch_id in (select batch_id from public.batch_teachers where teacher_id = public.current_app_user_id()))
  with check (public.has_role('teacher'));

create policy exams_admin on public.exams for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- exam_questions: teacher/admin always; student only via edge fn (attempt-bound).
create policy eq_teacher_admin on public.exam_questions for select to authenticated
  using (public.has_role('teacher') or public.is_admin());
create policy eq_write on public.exam_questions for all to authenticated
  using (public.has_role('teacher') or public.is_admin())
  with check (public.has_role('teacher') or public.is_admin());

-- exam_attempts: student reads own; teacher of batch reads all; admin all.
create policy ea_self on public.exam_attempts for select to authenticated
  using (student_id = public.current_app_user_id());
create policy ea_teacher on public.exam_attempts for select to authenticated
  using (public.has_role('teacher') and exam_id in (
    select id from public.exams where batch_id in (select batch_id from public.batch_teachers where teacher_id = public.current_app_user_id())
  ));
create policy ea_admin on public.exam_attempts for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
-- Writes via edge fn only.

-- exam_answers: student writes own.
create policy ean_self on public.exam_answers for all to authenticated
  using (attempt_id in (select id from public.exam_attempts where student_id = public.current_app_user_id()))
  with check (attempt_id in (select id from public.exam_attempts where student_id = public.current_app_user_id()));

-- Offline scores: student reads own, teacher of batch writes, admin all.
create policy ots_student on public.offline_test_scores for select to authenticated
  using (student_id = public.current_app_user_id());
create policy ots_teacher_read on public.offline_test_scores for select to authenticated
  using (public.has_role('teacher') and batch_id in (select batch_id from public.batch_teachers where teacher_id = public.current_app_user_id()));
create policy ots_teacher_write on public.offline_test_scores for insert to authenticated
  with check (public.has_role('teacher') and batch_id in (select batch_id from public.batch_teachers where teacher_id = public.current_app_user_id()));
create policy ots_teacher_update on public.offline_test_scores for update to authenticated
  using (entered_by = public.current_app_user_id())
  with check (entered_by = public.current_app_user_id());
create policy ots_admin on public.offline_test_scores for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
```

### 5.3 Edge fn: server-time (Checkpoint 3)

`apps/functions/server-time/index.ts`:
- No auth required.
- Returns `{ now: ISO8601, epoch_ms }`.
- Used by mobile client to compute clock offset.

### 5.4 Edge fn: exam-start (Checkpoint 4)

`apps/functions/exam-start/index.ts`:

Input: `{ exam_id }`.

Steps:
1. Verify student in exam's batch; exam is published.
2. Check `now >= starts_at` AND `now < starts_at + duration_min`. Else 400 (early/ended).
3. Try INSERT `exam_attempts` with `started_at=now()` ON CONFLICT (exam_id, student_id) DO NOTHING.
4. If insert happened: build `question_snapshot` = full question + options content (randomized per attempt), stripping `is_correct`. Persist to row.
5. If already existed: just load it.
6. Compute remaining time = `min(starts_at + duration_min, now + duration_min) - now`.
7. Return `{ attempt_id, questions: snapshot, remaining_sec }`.

### 5.5 Edge fn: exam-tab-switch (Checkpoint 5)

`apps/functions/exam-tab-switch/index.ts`:

Input: `{ attempt_id }`.

Steps:
1. Verify caller owns attempt.
2. UPDATE `tab_switch_count = tab_switch_count + 1`.
3. Return new count.

Fire-and-forget from client.

### 5.6 Edge fn: exam-submit (Checkpoint 6)

`apps/functions/exam-submit/index.ts`:

Input: `{ attempt_id }`.

Steps:
1. Verify caller owns attempt; submitted_at IS NULL.
2. Load exam + attempt.
3. **Server-time enforcement**: if `now > starts_at + duration_min`, mark `auto_submitted = true`.
4. Score per `exam_questions` × `exam_answers`: load each question's correct option; apply marking from `exams.marks_*`.
5. UPDATE `exam_attempts` with `submitted_at, score, max_score, auto_submitted`.
6. INSERT `activity_days`.
7. Trigger `mastery-recompute` (no-op stub until Phase 8).
8. Audit.
9. If `exams.result_release = 'instant'`, score is returned to client immediately; else returns `{ submitted: true }` only.

### 5.7 Edge fn: exam-release-results (Checkpoint 7)

`apps/functions/exam-release-results/index.ts`:

Input: `{ exam_id }`.

Steps:
1. Verify teacher of batch (or admin).
2. UPDATE `exams.results_released_at = now()`.
3. Audit.
4. Return success.

(Students see results from this point on.)

### 5.8 Edge fn: exam-regrade (Checkpoint 8)

`apps/functions/exam-regrade/index.ts`:

Input: `{ exam_id, question_id, action: 'change_correct'|'mark_no_correct'|'mark_all_correct', new_correct_option_id? }`.

Steps:
1. Verify teacher of batch (or admin).
2. Action:
   - `change_correct`: flip `is_correct` on the new option (set others false).
   - `mark_no_correct`: clear all `is_correct`; everyone gets `marks_skip`.
   - `mark_all_correct`: all options become correct; everyone gets `marks_correct`.
3. Walk all attempts of this exam; recompute scores.
4. Audit (with `before_data` showing previous correct option + previous attempt scores).
5. Return summary.

### 5.9 Edge fn: offline-score-upsert (Checkpoint 9)

`apps/functions/offline-score-upsert/index.ts`:

Input: `{ batch_id, test_name, test_date, subject_id?, max_score, entries: [{ student_id, score, notes? }] }`.

Steps:
1. Verify teacher of batch.
2. Validate each score: `0 <= score <= max_score`.
3. UPSERT `offline_test_scores` per entry.
4. Audit.
5. Return.

## 6. Frontend work

### 6.1 Mobile: exam-builder (Checkpoint 10)

`apps/mobile/app/(teacher)/exam-builder.tsx`:

Form sections:
- Title, batch picker (auto-scoped), starts_at picker (date + time, 15-min rounded), duration preset.
- Marking + randomization + result release.
- Questions: drag-reorder, add from bank, add new.

Save Draft / Publish.

After publish: visible to students 24h before start (banner countdown).

### 6.2 Mobile: exam attempt (Checkpoint 11)

`apps/mobile/app/(student)/exam/[id].tsx`:

**Pre-attempt (`stage=pre`)**: title, rules, countdown to `starts_at`, "Enter Exam" disabled until live.

**Attempt (`stage=attempt`)**:
- Plain `View`/`Text` — no animations, no Reanimated.
- Top bar: title + timer pill (server-synced via `server-time` poll every 60s).
- Question card, options, flag.
- Q-grid + Submit button at bottom.
- Tab/app-switch listener via `AppState`:
  ```ts
  AppState.addEventListener('change', (next) => {
    if (next !== 'active') {
      fetch('/functions/v1/exam-tab-switch', ...);  // fire-and-forget
    }
  });
  ```
- Display warning banner after 1 switch; full-screen warning after 3.
- Auto-save on option select / flag toggle (debounced 500ms).

**Submit (`stage=submitted`)**: "Submitted. Results will be released by your teacher."

**Result (`stage=result`)**: if results released, shows score + per-question solution view (same as quiz, but no retake).

### 6.3 Mobile: exam results (teacher) (Checkpoint 12)

`apps/mobile/app/(teacher)/exam/[id]/results.tsx`:
- Header: title, status, "Release Results" button if not released.
- Roster sorted by score; each row shows name, score, tab_switch_count flag if >0.
- Question analysis: per question, % correct; tap → "Regrade".
- Regrade modal: pick new correct, or mark no-correct, or all-correct; reason required.

### 6.4 Mobile: offline scores (Checkpoint 13)

`apps/mobile/app/(teacher)/offline-scores.tsx`:
- Batch + test name + date + subject + max score header.
- Roster rows with numeric input.
- Save All.

### 6.5 Admin: exams oversight (Checkpoint 14)

`apps/admin/app/(dashboard)/exams/page.tsx`:
- DataTable of all exams across batches.
- Filter by batch, status (draft/scheduled/live/closed/released), date range.
- Click row → detail with results.
- Owner override: force-release results.

## 7. Files changed (summary)

### Mobile — added
- `app/(student)/exam/[id].tsx`
- `app/(teacher)/exam-builder.tsx`
- `app/(teacher)/exam/[id]/results.tsx`
- `app/(teacher)/offline-scores.tsx`
- `components/exam/ExamGate.tsx`, `TabSwitchWarning.tsx`, `ResultBanner.tsx`, `LockedDownAttempt.tsx`
- `features/exam/useExamState.ts`, `useServerTime.ts`, `useTabSwitchLogger.ts`, `useExamSubmit.ts`

### Mobile — edited
- `app/(student)/classes.tsx` — add "Exams" tab listing scheduled/live/completed exams.

### Edge fns added
- `server-time`, `exam-start`, `exam-tab-switch`, `exam-submit`, `exam-release-results`, `exam-regrade`, `offline-score-upsert`

### Admin
- `/exams` page

### Shared
- `packages/shared/src/validation/examSchemas.ts`
- `packages/shared/src/time/serverTime.ts` (offset calc helper)

## 8. Integration & cross-cutting

- Audit: `exam_create`, `exam_publish`, `exam_unpublish`, `exam_release_results`, `exam_regrade`, `offline_score_upsert`.
- Telemetry: `exam_published`, `exam_started`, `exam_tab_switch`, `exam_submitted`, `exam_results_released`, `exam_regrade`.
- Notifications: not in MVP; students rely on schedule. Phase 12 may add a one-time "exam now live" toast if app is open.

## 9. Risks & gotchas

| Risk | Mitigation |
|---|---|
| Phone clock skew → student thinks exam is live before server agrees | Server checks `starts_at`; client UI uses server offset. |
| `AppState` event misses on iOS background scenarios | Add a focus listener (`AppState.addEventListener('focus')`) as a redundant trigger. |
| Tab-switch counter not crashing server when network drops | Debounce + retry queue; final count reconciled on next foreground. |
| Exam grading wrong due to randomized option order | `question_snapshot` stored on attempt; scoring uses snapshot, not live data. |
| Two-device same student → double tab-switch counts | Add idempotency key (timestamp bucket); de-dupe within 5s. (Or accept slight over-counting for MVP.) |
| Regrade panics teachers — they don't know what changed | Confirmation modal shows before/after counts; audit records the whole event. |
| Mid-exam network failure → student stuck | Auto-save means answers persist; on re-open within window, attempt resumes. |
| Auto-submit at exact timer end → race | Server-side check is authoritative; even if client misses, server enforces on submit attempt or via cron sweep. |

## 10. Acceptance criteria

1. Teacher creates an exam (10 Qs, 15 min) and publishes.
2. Student sees exam in `Classes > Exams` tab with countdown.
3. Student tries to enter before start → "Starts in X min" disabled CTA.
4. At start time, student enters → locked-down attempt UI loads in <2s.
5. Timer matches server time within ±2 seconds (verified by inspecting two devices).
6. Student answers some Qs, flags one, switches to home screen and back → warning banner shows "Switches: 1".
7. Student tries to change device clock to add 20 min → submit still cuts at server `starts_at + duration_min`.
8. Student submits → success screen "Results will be released".
9. Teacher views results → roster + question analysis. Flags student with tab_switch_count=4 visible.
10. Teacher regrades a question (mark new correct) → roster scores recomputed; audit log shows the change.
11. Teacher releases results → student now sees score + solution view with explanation.
12. `result_release='instant'` exam: score appears immediately on submit.
13. Auto-submit edge case: student leaves attempt open past timer → next "Enter" attempt is blocked with "Submitted (auto)".
14. Offline scores: teacher enters 30 students' marks → all persisted; visible to student in profile detail (read-only).
15. Network inspection during attempt: no `is_correct` in payload.
16. Two devices same student: both see same questions in same order (snapshot honored).
17. Exam screen passes performance budget: <200ms transition, no Reanimated, smooth scroll.
18. CI green; RLS tests cover student/teacher/admin scopes.

## 11. Test plan

### Unit
- Scoring engine with various marking schemes.
- Server-time offset calc with simulated drift.
- Tab-switch debouncer.

### Integration
- `exam-start`: cannot start outside window; idempotent within window.
- `exam-submit`: timer enforcement; idempotency on re-submit.
- `exam-regrade`: all three modes recompute correctly.
- `offline-score-upsert`: validation + RLS.

### RLS
- Student of batch A cannot enter exam of batch B.
- Teacher of batch A cannot regrade exam of batch B.
- Offline score visible to correct student only.

### Manual QA
- Real exam dry run on Redmi 8A: 30 Qs, 60 min, full duration.
- Two devices simultaneously taking same exam (different students).
- Tamper attempts: clock change, force-close mid-exam, airplane mode mid-exam.

## 12. Rollback plan

If Phase 7 breaks:
1. Revert migrations 0015, 0016.
2. Mobile exam screens revert to "Coming soon".
3. Quizzes from Phase 6 still work.

## 13. Definition of done

- [ ] All 18 AC pass.
- [ ] Manual exam dry run completed without errors.
- [ ] Server-time enforcement tested with clock manipulation.
- [ ] CI green.
- [ ] User says "Phase 7 accepted".

## 14. Hand-off to Phase 8

- `quiz_attempts` + `exam_attempts` populated.
- Mastery feeder stubs in place (no-op).
- Phase 8 implements real `mastery-recompute`, `streak-recompute`, and rebuilds the dashboard with live data.

---

## 15. Acceptance ledger — Phase 7 (2026-05-19)

All 14 documented checkpoints (CP1–CP14) plus two implementation extensions (CP9b: re-fetch + admin-mutate; CP15: tests + advisor sweep) green. DB: 2 new migrations applied. Edge fns: 9 deployed. Mobile: 4 new top-level Stack screens (`app/exam/[id].tsx`, `app/exam-builder/[examId].tsx`, `app/exam-results/[examId].tsx`, `app/offline-scores.tsx`) + 1 new teacher tab (`(teacher)/exams.tsx`) + 1 new component + 9 feature hooks + 1 edge-fn invoker (`lib/edge-fn.ts`). Student dashboard surfaces upcoming/live/submitted exams. Admin: 2 new dashboard pages (`/exams`, `/offline-scores`) + server actions routed through the new audited `exam-admin-mutate` edge fn.

### Checkpoints

| CP   | Subject | Outcome | Where |
|------|---------|---------|-------|
| CP1  | `exams` + `exam_questions` + `exam_attempts` + `exam_answers` + `offline_test_scores` migration | ✅ applied; 5 tables, 4 partial indexes (`exams_published_idx`, `exams_release_idx`, `exam_attempts_active_idx`, `offline_test_scores_subject_idx`), UNIQUE on `(exam_id, student_id)` + `(batch_id, student_id, test_name, test_date)`; 2 trigger fns pinned to `set search_path = public, pg_temp` per D-166 | `supabase/migrations/20260519110000_exams.sql` |
| CP2  | RLS across 5 new tables | ✅ applied; 24 policies; students cannot SELECT exam_questions of exams in other batches; exam_answers append-only post-submit (WITH CHECK rejects); offline_test_scores scoped per student / per batch-teacher | `supabase/migrations/20260519110500_exams_rls.sql` |
| CP3  | `server-time` edge fn | ✅ deployed with `--no-verify-jwt`; returns `{ now, epoch_ms }`; powers mobile clock-offset sync | `apps/functions/server-time/index.ts` |
| CP4  | `exam-start` edge fn | ✅ deployed; student-only; verifies batch scope; idempotently reuses in-flight attempt; snapshots question + option content + correct_option_id (server-side) into `exam_attempts.question_snapshot`; sanitises payload before serialising (strips `correct_option_id` and `is_correct`); signs prompt/option image URLs (6h TTL); computes late-entry-aware `deadline_at = min(starts_at+duration, now+duration)` per D-052 | `apps/functions/exam-start/index.ts` |
| CP5  | `exam-tab-switch` edge fn | ✅ deployed; student-only; bumps `tab_switch_count`; no auto-submit per D-055; silently no-ops on already-submitted attempts so fire-and-forget after submit doesn't error the client | `apps/functions/exam-tab-switch/index.ts` |
| CP6  | `exam-submit` edge fn | ✅ deployed; student-only; grades server-side from snapshot (live bank edits do NOT affect in-flight attempt); 409 on replay; upserts `activity_days` (IST per D-014); audits `exam_submitted`; instant-release returns score+counts immediately, manual returns `{ submitted, results_released: false }` | `apps/functions/exam-submit/index.ts` |
| CP7  | `exam-release-results` edge fn | ✅ deployed; teacher of batch OR creator-of-exam OR admin; idempotent on already-released; audits `exam_results_released` with before/after | `apps/functions/exam-release-results/index.ts` |
| CP8  | `exam-regrade` edge fn | ✅ deployed; teacher of batch or admin; 3 actions (`change_correct`, `mark_no_correct`, `mark_all_correct`); FULL per-attempt recompute model — encodes `mark_*` semantics via `snapshot.regrade_override` so stacked regrades don't drift; audit_log captures full before/after with prev options + per-attempt deltas | `apps/functions/exam-regrade/index.ts` |
| CP9  | `offline-score-upsert` edge fn | ✅ deployed; teacher of batch or admin; validates `0 ≤ score ≤ max_score`; validates student belongs to batch; validates subject belongs to batch's course; UPSERTs on `(batch_id, student_id, test_name, test_date)`; audits with per-student before/after snapshot | `apps/functions/offline-score-upsert/index.ts` |
| CP9b | `exam-attempt-result` + `exam-admin-mutate` (NEW — D-179) | ✅ deployed; re-openable solution view per D-175 with 423 LOCKED gate for student pre-release; single discriminated-union admin fn per D-177 with 5 ops (`toggle_publish_exam`, `force_release_results`, `force_unrelease_results`, `delete_exam`, `delete_offline_score`) | `apps/functions/{exam-attempt-result,exam-admin-mutate}/index.ts` |
| CP10 | Mobile teacher exam-builder | ✅ wired at top-level `app/exam-builder/[examId].tsx` (outside `(teacher)` tabs per D-169 — mirrors D-157); new "Exams" tab in `(teacher)/_layout.tsx`; batch picker (RLS-scoped to teacher's assigned batches), 15-min-rounded start picker, duration presets, marking + randomization + release toggles, drag-reorder questions + add-from-bank sheet | `apps/mobile/app/exam-builder/[examId].tsx`, `apps/mobile/app/(teacher)/exams.tsx`, `apps/mobile/features/exam/{useTeacherBatches,useTeacherExamBuilder,useTeacherExams}.ts` |
| CP11 | Mobile student exam attempt | ✅ wired at top-level `app/exam/[id].tsx`; 5-stage state machine (pre → attempt → submitted → result → solution); `AppState` listener fires `exam-tab-switch` on `active→(background|inactive)`; warning banner at 1+, severe banner at 3+; server-anchored TimerPill auto-submits on expiry; auto-save via debounced upsert to `exam_answers`; no Reanimated / no animations per exam-screen perf budget | `apps/mobile/app/exam/[id].tsx`, `apps/mobile/features/exam/{useExamStart,useExamSubmit,useExamAttemptResult,useExamAutoSave,useExamTabSwitchLogger,useServerTimeOffset}.ts`, `apps/mobile/components/exam/TabSwitchBanner.tsx`, `apps/mobile/lib/edge-fn.ts` |
| CP12 | Mobile teacher exam results + regrade | ✅ wired at top-level `app/exam-results/[examId].tsx`; roster sorted by score desc, per-student `tab_switch_count` badge (warn at 1+, severe at 3+) + `auto_submitted` flag; per-question analysis bar (green/amber/red thresholds 70/40/<40); release button only when not released; regrade modal with 3 actions + reason field (audit_log) | `apps/mobile/app/exam-results/[examId].tsx`, `apps/mobile/features/exam/useExamResultsBoard.ts` |
| CP13 | Mobile teacher offline-scores | ✅ wired at top-level `app/offline-scores.tsx` (reachable from teacher Exams tab → "Offline" button); batch + test name + date + subject (optional) + max_score header; per-student numeric input with "previous: N" hint when score already exists; client-side range validation before `offline-score-upsert` | `apps/mobile/app/offline-scores.tsx`, `apps/mobile/features/exam/{useOfflineScores,useBatchSubjects}.ts` |
| CP14 | Admin `/exams` + `/offline-scores` pages | ✅ wired; `/exams` shows status badge (draft/scheduled/live/closed/released) per-row, filters by course/batch/status/search, exports CSV (IST pinned), publish/unpublish + force-release/un-release + delete buttons all routed through `exam-admin-mutate` (D-172); `/offline-scores` shows all scores across batches with search + CSV export + delete (single-row delete via `exam-admin-mutate` op `delete_offline_score`); 2 new nav items | `apps/admin/app/(dashboard)/{exams,offline-scores}/{page,*-client,actions}.tsx`, `apps/admin/app/(dashboard)/layout.tsx` |
| CP15 | Tests + smokes + advisor sweep | ✅ green | see below |
| CP16 | Ledger + manual test plan + seed + memory + commit | ✅ this entry | here |

### Migrations applied (2 new)

| Timestamp | Name | Purpose |
|-----------|------|---------|
| 20260519110000 | `exams` | 5 tables — `exams` (16 cols), `exam_questions` (4), `exam_attempts` (14), `exam_answers` (5), `offline_test_scores` (12). 19 indexes (incl. 4 partial). 2 trigger fns `_exams_updated_at` + `_offline_test_scores_updated_at` both pinned `set search_path = public, pg_temp` per D-166. |
| 20260519110500 | `exams_rls` | RLS enabled on all 5 tables. 24 policies. Key invariants: student SELECT scoped to own batch's published exams; student INSERT/UPDATE on `exam_answers` rejected once `submitted_at IS NOT NULL`; teacher batch-teachers scoping mirrors Phase 6 quiz patterns; admin-all for owner_admin / staff_admin. |

### Edge functions deployed (9 new)

`server-time` (no verify_jwt), `exam-start`, `exam-tab-switch`, `exam-submit`, `exam-release-results`, `exam-regrade`, `offline-score-upsert`, `exam-attempt-result`, `exam-admin-mutate`. All but `server-time` deployed with `verify_jwt = true`. Deployed via Supabase CLI 2.100.0 (`functions deploy --use-api`) from a temp workdir per D-170 against project `orqwyazvcthgxoadfxfv`.

### Vault secrets

No new Vault secrets required. Phase 7 reuses Phase 5's `exam-images` Storage bucket for any prompt/option images (D-058 — bank shared with Phase 6 quizzes).

### Tests + smokes

- `pnpm test:exam` — pure-TS unit smoke covering `gradeAnswer`, `gradeAttempt`, `sanitiseSnapshotForStudent`, `regradedCorrectOptionId`, `applyMark{All,No}CorrectOverride`, `computeRemainingSec`, `isAutoSubmittedAt`, `shuffleStable`. **26/26 green.**
- `pnpm smoke:exam-rls` — end-to-end RLS smoke (12 scenarios): batch-scope leakage, student-cannot-see-other-batch's exam, exam_questions of other batch hidden, student own-attempt visibility, in-flight upsert allowed, post-submit upsert rejected, cross-student answer leakage blocked, teacher scope, `exam-attempt-result` 423-pre-release / 200-post-release, offline_test_scores per-student visibility. **All assertions green.**
- `pnpm smoke:exam-fns` — HTTP smoke for all 9 Phase 7 edge fns. **26/26 assertions green.** Covers auth + role gates, scope, idempotency, replay protection (`exam-submit` 409 second call), instant-release scoring, audit-row verification (`exam_submitted`, `exam_results_unreleased`), all 3 regrade actions including the FULL-recompute correctness across stacked regrades (mark_no_correct then mark_all_correct correctly restores +4), offline-score-upsert insert vs update counts + out-of-range rejection.
- `pnpm test --filter @fynestudy/mobile` — 6 suites / 53 tests. **53/53 green.**
- `pnpm typecheck` — every workspace package green after fixing 8 strict-mode issues in exam-builder swaps + offline-scores filter + results-board embed cast.
- `pnpm lint` — every workspace package green after escaping 3 JSX entities in offline-scores-client confirmation modal.

### Advisor sweep

| Lint | Status |
|------|--------|
| `auth_leaked_password_protection` | WARN, Phase-1 backlog. Not Phase 7. |
| `multiple_permissive_policies` × 16 on Phase 7 tables | Intentional. Same role-segmented pattern as Phase 5/6 — student-read vs teacher-read vs admin-all live as separate permissive policies because each represents a distinct authorization path. Documented as accepted. |
| `unindexed_foreign_keys` on `exam_answers.question_id`, `exam_answers.selected_option_id`, `offline_test_scores.entered_by` | 3 INFOs. The hot read path on `exam_answers` is always `attempt_id` (covered by `exam_answers_attempt_idx`); `offline_test_scores.entered_by` is admin-audit-only. Accepted. |
| `unused_index` on `exams_published_idx`, `exams_release_idx` | 2 INFOs. Brand-new indexes — will flip to "used" once the student dashboard pulls live exams and the teacher results page filters released. |
| All other Phase 7-touched objects | Clean. The new trigger fns `_exams_updated_at` and `_offline_test_scores_updated_at` ship with `set search_path = public, pg_temp` per D-166 — advisor 0011 silent. |

### Hard-learned lessons / new decisions

- **D-179 (2026-05-19):** Regrade fns must do a FULL per-attempt recompute, not incremental delta math. The original delta approach (compute `prev` outcome against the snapshot's current key, compute `next`, write delta) drifts across stacked regrades because each regrade mutates the snapshot key but the `prev` re-derivation reads the post-mutation state — so the delta is measured against the wrong baseline. Surfaced when smoke test stacked `mark_no_correct` + `mark_all_correct` on the same question and got score 4 instead of 3. **Fix:** introduced `snapshot.question.regrade_override: "all"|"none"|null` (in addition to `correct_option_id` updates for `change_correct`). Each regrade pass builds the full per-Q grading via `gradeAttempt` against snapshot + answers + overrides, then writes totals + the new snapshot. Idempotent and order-independent. **How to apply:** any future re-grading surface that mutates per-question keys post-submit should mirror this pattern.

- **D-180 (2026-05-19):** Question snapshot must be a self-contained server-side grading dossier, not just an "order pinning" hint. Phase 6 quiz snapshot stored only `(question_order, option_order)` in `quiz_attempts.metadata` because live bank edits during a quiz attempt are acceptable. Phase 7 exams REQUIRE that mid-window bank edits don't change in-flight grades (D-052), so `exam_attempts.question_snapshot` is `not null` jsonb with the full prompt/options/correct_option_id at attempt start. Sanitisation strips `correct_option_id` before client serialise; grading reads it directly. **How to apply:** any future "high-stakes" attempt-style surface (Phase 12 multi-part exams, Phase 13 mock tests) snapshots both content + key, not just order. Quiz-style "practice" surfaces can keep the lighter Phase 6 metadata-only shape.

- **D-181 (2026-05-19):** `server-time` edge fn must deploy with `--no-verify-jwt`. The mobile client's `useServerTimeOffset` is called pre-attempt (during the intro stage warmup) and every 60s during the attempt; it carries no PII, no scope, just `{ now, epoch_ms }`. JWT verification would force the client to attach Authorization, which means the call would fail during the brief window when the access token is refreshing. The downside (anyone can fetch the server clock) is negligible. The CLI flag `--no-verify-jwt` was passed on the FIRST deploy after the smoke test discovered the 401. **How to apply:** any future "public utility" edge fn (e.g., Phase 9 live-class poll for the broadcast `liveBroadcastContent.status` — unrelated to a specific user) should deploy with `--no-verify-jwt` for the same reason.

- **D-182 (2026-05-19):** Per-attempt tab-switch logging must be FIRE-AND-FORGET (no `await`) on the client and SILENT on already-submitted attempts on the server. The `AppState` `change` event can fire ANY time the OS backgrounds the app — including milliseconds after a successful submit — so the client's `useExamTabSwitchLogger` does not block UI on the call, and the server's `exam-tab-switch` returns 200 (with no count bump) instead of 409 when the attempt is already submitted. Surfaced during smoke setup when the smoke harness ran submit + tab-switch in rapid succession. **How to apply:** any future "live telemetry" edge fn that can race a state-changing fn must silently no-op on the terminal state rather than 4xx (so the client UI doesn't surface a spurious error toast).

- **D-183 (2026-05-21):** Exam-timer integrity is DEFENSE-IN-DEPTH — a client server-offset resync PLUS a server-side answer-write deadline cut. Manual-QA code review found `useServerTimeOffset` was DEAD CODE: `TimerPill` counted down from a single mount-time anchor on the **device wall-clock**, so a mid-attempt clock change (especially *backward*) could inflate the on-screen countdown and let a student keep auto-saving answers past the real deadline — those answers were still graded, only `auto_submitted` got flagged. **Fix, two layers:** (1) CLIENT — `TimerPill` takes an optional `offsetMs` prop (defaults to `0` → Phase 6 quiz behaviour byte-identical); the exam screen wires `useServerTimeOffset(server_now)`, which re-syncs from the public `server-time` fn every 60s, so the countdown self-corrects within one window and auto-submits at the REAL deadline even after tampering. (2) SERVER — migration `20260521120000_exam_answers_deadline_cut` tightens `exam_answers_student_insert` + `_update` WITH CHECK to also require `now() < coalesce(deadline_at, 'infinity') + interval '30 seconds'` (PK-indexed on `exam_attempts.deadline_at`, null-safe, 30s jitter grace for honest slow-network saves). Proven by new smoke assertion **T4b** (post-deadline upsert → 403). **How to apply:** any future server-timed attempt surface must (a) drive the client countdown off a periodically-resynced server offset, never a frozen device snapshot, and (b) enforce the cut server-side at the write path — never trust the client to stop.

### Files changed (summary)

**Mobile — added:**
- `app/exam/[id].tsx` (top-level student locked-down attempt + result + solution)
- `app/exam-builder/[examId].tsx` (top-level teacher builder)
- `app/exam-results/[examId].tsx` (top-level teacher results + regrade)
- `app/offline-scores.tsx` (top-level teacher offline-score entry)
- `app/(teacher)/exams.tsx` (new teacher tab)
- `components/exam/TabSwitchBanner.tsx`
- `features/exam/{types,useExamStart,useExamSubmit,useExamAttemptResult,useExamAutoSave,useExamTabSwitchLogger,useServerTimeOffset,useTeacherExams,useTeacherExamBuilder,useTeacherBatches,useStudentExams,useExamResultsBoard,useOfflineScores,useBatchSubjects}.ts`
- `lib/edge-fn.ts` (typed POST helper that surfaces HTTP status — needed for 409/423/etc.)

**Mobile — edited:**
- `app/_layout.tsx` (+4 Stack.Screen entries: `exam/[id]`, `exam-builder/[examId]`, `exam-results/[examId]`, `offline-scores`)
- `app/(teacher)/_layout.tsx` (+Exams tab)
- `app/(student)/index.tsx` (+Exams section above Weak Topics; refresh hook wires `useStudentExams.reload`)

**Edge fns — added:** `apps/functions/{server-time,exam-start,exam-tab-switch,exam-submit,exam-release-results,exam-regrade,offline-score-upsert,exam-attempt-result,exam-admin-mutate}/index.ts`

**Shared — added/edited:**
- `apps/functions/_shared/exam-marking.ts` (new — pure helpers; supports `regrade_override` per D-179)
- `apps/functions/_shared/schemas.ts` (+7 zod schemas — `ExamStartInputSchema`, `ExamTabSwitchInputSchema`, `ExamSubmitInputSchema`, `ExamAttemptResultInputSchema`, `ExamReleaseResultsInputSchema`, `ExamRegradeInputSchema`, `OfflineScoreUpsertInputSchema`, `ExamAdminMutateInputSchema`)

**Migrations — added:** `20260519110000_exams.sql`, `20260519110500_exams_rls.sql`

**Admin — added:**
- `apps/admin/app/(dashboard)/exams/{page,exams-client,actions}.tsx`
- `apps/admin/app/(dashboard)/offline-scores/{page,offline-scores-client,actions}.tsx`

**Admin — edited:** `apps/admin/app/(dashboard)/layout.tsx` (+Exams, +Offline scores nav items)

**Scripts — added:** `scripts/{test-exam-helpers,smoke-test-exam-rls,smoke-test-exam-edge-fns,seed-exam-manual-test,stage-phase7-deploy}.{ts,cjs}`. New npm scripts `test:exam`, `smoke:exam-rls`, `smoke:exam-fns`, `seed:exam-manual-test` in root `package.json`.

### Phase 7 carry-overs into Phase 8+

- `mastery-recompute` invocation hook (still no-op TODO in `exam-submit` because the Phase 8 fn doesn't ship yet — wiring is in place though, ready to swap in).
- Quiz + Exam tabs together are 8 entries on the teacher tab bar — visually crowded on narrow phones. Phase 8 may consolidate into a single "Tests" tab with internal toggles.
- Student-facing `(student)/classes.tsx` still shows the Phase 0 placeholder cards. Phase 8 should replace with the same `useStudentExams` + real-sessions feed shape now used on the home dashboard.
- Two-device same-student de-dupe on `exam-tab-switch` is acceptable over-counting per spec §9 risk table. Phase 12 could add a 5s debounce per device-key if teachers report it being noisy.
- Component-level jest for the locked-down attempt UI (timer, AppState wiring) — deferred.
- Redmi 8A cold-start measurement on `app/exam/[id].tsx` (hardware blocker, Phase 5 carry-over still open).
- Local KaTeX bundle (Phase 9 hardening — Phase 6 carry-over).
- Vercel deployment fix, Sentry + PostHog wiring, `auth_leaked_password_protection` (long-running Phase 1 carry-overs).

### Phase 7 status: **✅ ACCEPTED — 2026-05-21**

CP1–CP16 + 118 automated assertions + advisor sweep green, AND manual QA walked end-to-end on iOS Expo Go + the admin browser: §A admin oversight, §B teacher exam-builder + offline scores, §C student attempt happy-path, §D edge cases (backend-verified live + via smokes), §E teacher release + regrade. The walkthrough plus a fresh code-review pass shook out the patches below; all green at sign-off.

### Post-QA fixes (2026-05-21)

1. **Server-time timer integrity (D-183)** — `useServerTimeOffset` was dead code; `TimerPill` counted down on the device wall-clock from a single mount anchor (a backward clock change could inflate the timer + let answers be saved past the deadline). Fixed two-layer: client `TimerPill` now takes an optional `offsetMs` (re-synced every 60s via the now-wired `useServerTimeOffset`; quiz path byte-identical), and a new migration `20260521120000_exam_answers_deadline_cut` rejects `exam_answers` writes once `now() ≥ deadline_at` (+30s grace). New smoke assertion **T4b** proves a post-deadline write → 403.
2. **Instant-exam re-open stuck on "Check release status"** — `loadPre` routed every submitted attempt to the `submitted` stage; instant exams have no `results_released_at`, so it could never flip to the score. Now instant-submitted → `result` directly; `lazyResult` loads in the `result` stage on re-open; the submitted-stage release check is instant-aware. `app/exam/[id].tsx`.
3. **Builder question-replace non-atomic** — `delete`-then-`insert` left a published exam with zero questions on a partial failure. Now upsert-the-set-then-delete-missing (never empty). `app/exam-builder/[examId].tsx`.
4. **Default exam start rounded to 15 min, not 30** — `nextHalfHourStartsAt` now rounds to a true 30-min slot per §B3/§B5. `app/exam-builder/[examId].tsx`.
5. **Admin offline-score delete modal** — added backdrop-click-to-close to match the exams modal. `offline-scores-client.tsx`.
6. Pre-existing working-tree QA fixes confirmed in place: admin exams-delete-modal backdrop close, exam-results "Release" button recoloured blue, offline-scores hydration no longer clobbers typed values, results-board analysis bar honours `regrade_override` (D-179).

Migrations now **3** (`exams`, `exams_rls`, `exam_answers_deadline_cut`). Edge fns unchanged at 9. Post-fix regression: `pnpm test:exam` 26/26, `pnpm smoke:exam-rls` green incl. **T4b**, `pnpm smoke:exam-fns` 26/26, mobile jest 53/53, typecheck + lint green, security advisor clean (only the long-standing Phase-1 `auth_leaked_password_protection` WARN). Work sits uncommitted on `phase-4` branch.

### ACCEPTED — 2026-05-21 by Kaustab
