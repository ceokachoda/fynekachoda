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
