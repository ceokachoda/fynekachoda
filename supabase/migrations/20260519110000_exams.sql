-- Phase 7 CP1 — exams, exam_questions, exam_attempts, exam_answers,
-- offline_test_scores.
--
-- Graded examinations are higher-stakes than Phase 6 practice quizzes:
--   - One attempt per (exam, student); enforced by UNIQUE.
--   - Server-time enforced hard cut at `starts_at + duration_min`.
--   - Per-attempt `question_snapshot` jsonb PINS the prompt/option content +
--     correct_option_id at attempt start (D-052). Teacher mid-window edits
--     do NOT change in-flight attempts — they go through `exam-regrade`.
--   - Tab-switch counter is logged but never auto-submits (D-055).
--   - Results released MANUALLY by teacher by default (D-056); per-exam
--     opt-in `result_release='instant'` reveals score on submit.
--   - Offline test scores feed mastery + parents' report (D-059); upsertable
--     via natural key (batch, student, test_name, test_date).
--
-- Question bank is shared with Phase 6 quizzes (D-057). RLS lives in
-- 20260519110500_exams_rls. Helper functions in `private` schema (D-146).
-- Every new trigger fn pins `set search_path = public, pg_temp` (D-166).

create table public.exams (
  id                   uuid        primary key default gen_random_uuid(),
  title                text        not null check (char_length(title) between 1 and 200),
  batch_id             uuid        not null references public.batches(id) on delete cascade,
  starts_at            timestamptz not null,
  duration_min         int         not null check (duration_min between 1 and 360),
  marks_correct        numeric(6,2) not null default 4   check (marks_correct > 0),
  marks_wrong          numeric(6,2) not null default -1  check (marks_wrong  <= 0),
  marks_skip           numeric(6,2) not null default 0   check (marks_skip   <= 0),
  randomize_questions  boolean     not null default true,
  randomize_options    boolean     not null default true,
  result_release       text        not null default 'manual'
                       check (result_release in ('manual','instant')),
  results_released_at  timestamptz,
  is_published         boolean     not null default false,
  created_by           uuid        not null references public.app_users(id),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index exams_batch_starts_idx     on public.exams (batch_id, starts_at desc);
create index exams_created_by_idx       on public.exams (created_by);
create index exams_published_idx        on public.exams (is_published) where is_published = true;
create index exams_release_idx          on public.exams (results_released_at) where results_released_at is not null;

create or replace function public._exams_updated_at() returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke execute on function public._exams_updated_at() from public, anon, authenticated;
grant  execute on function public._exams_updated_at() to service_role;

create trigger exams_updated_at_trg
  before update on public.exams
  for each row execute function public._exams_updated_at();

-- ----------------------------------------------------------------------------

create table public.exam_questions (
  exam_id     uuid not null references public.exams(id)    on delete cascade,
  question_id uuid not null references public.questions(id) on delete restrict,
  sort_order  int  not null default 0 check (sort_order between 0 and 9999),
  added_at    timestamptz not null default now(),
  primary key (exam_id, question_id)
);

create index exam_questions_question_idx on public.exam_questions (question_id);

-- ----------------------------------------------------------------------------

create table public.exam_attempts (
  id                uuid        primary key default gen_random_uuid(),
  exam_id           uuid        not null references public.exams(id) on delete cascade,
  student_id        uuid        not null references public.students(user_id) on delete cascade,
  started_at        timestamptz not null default now(),
  deadline_at       timestamptz not null,
  submitted_at      timestamptz,
  auto_submitted    boolean     not null default false,
  tab_switch_count  int         not null default 0 check (tab_switch_count >= 0),
  score             numeric(8,2),
  max_score         numeric(8,2),
  correct_count     int,
  wrong_count       int,
  skipped_count     int,
  -- {"questions":[{"id","prompt_md","prompt_image_path","difficulty","topic_id",
  --                "options":[{"id","text_md","image_path"}],
  --                "correct_option_id":"..." }]}
  -- correct_option_id is server-only and NEVER serialised to the student
  -- client during an attempt. See exam-start / exam-submit.
  question_snapshot jsonb       not null,
  unique (exam_id, student_id),
  check (
    submitted_at is null
    or (
      submitted_at >= started_at
      and score is not null and max_score is not null
      and correct_count is not null and wrong_count is not null and skipped_count is not null
    )
  )
);

create index exam_attempts_student_submitted_idx on public.exam_attempts (student_id, submitted_at desc);
create index exam_attempts_exam_score_idx        on public.exam_attempts (exam_id, score desc);
-- Idempotency: fast lookup of the live attempt for (exam, student).
create index exam_attempts_active_idx            on public.exam_attempts (student_id, exam_id) where submitted_at is null;

-- ----------------------------------------------------------------------------

create table public.exam_answers (
  attempt_id         uuid not null references public.exam_attempts(id) on delete cascade,
  question_id        uuid not null references public.questions(id)     on delete restrict,
  selected_option_id uuid references public.question_options(id) on delete set null,
  is_flagged         boolean not null default false,
  answered_at        timestamptz,
  primary key (attempt_id, question_id)
);

create index exam_answers_attempt_idx on public.exam_answers (attempt_id);

-- ----------------------------------------------------------------------------

create table public.offline_test_scores (
  id          uuid        primary key default gen_random_uuid(),
  batch_id    uuid        not null references public.batches(id)              on delete cascade,
  student_id  uuid        not null references public.students(user_id)        on delete cascade,
  subject_id  uuid        references public.subjects(id)                      on delete set null,
  test_name   text        not null check (char_length(test_name) between 1 and 200),
  test_date   date        not null,
  score       numeric(8,2) not null check (score >= 0),
  max_score   numeric(8,2) not null check (max_score > 0),
  notes       text        check (notes is null or char_length(notes) <= 1000),
  entered_by  uuid        not null references public.app_users(id),
  entered_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (score <= max_score),
  -- Natural key for the per-entry upsert in `offline-score-upsert`.
  unique (batch_id, student_id, test_name, test_date)
);

create index offline_test_scores_batch_date_idx on public.offline_test_scores (batch_id, test_date desc);
create index offline_test_scores_student_idx    on public.offline_test_scores (student_id, test_date desc);
create index offline_test_scores_subject_idx    on public.offline_test_scores (subject_id) where subject_id is not null;

create or replace function public._offline_test_scores_updated_at() returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke execute on function public._offline_test_scores_updated_at() from public, anon, authenticated;
grant  execute on function public._offline_test_scores_updated_at() to service_role;

create trigger offline_test_scores_updated_at_trg
  before update on public.offline_test_scores
  for each row execute function public._offline_test_scores_updated_at();

-- ----------------------------------------------------------------------------

comment on table public.exams is
  'Phase 7 graded exams. RLS in 20260519110500_exams_rls. One attempt per (exam, student) — unique on exam_attempts. Question content snapshotted at attempt start (D-052).';
comment on table public.exam_questions is
  'Junction; questions are pulled from the shared bank with practice quizzes (D-057). Live bank edits do NOT propagate to in-flight attempts (see exam_attempts.question_snapshot).';
comment on table public.exam_attempts is
  'One row per (exam, student). question_snapshot pins the prompt/option content + correct_option_id at start. Grading reads correct_option_id from snapshot; regrade reads from live question_options.is_correct.';
comment on table public.exam_answers is
  'Per-question response within an exam attempt. Auto-saved on each option select / flag.';
comment on table public.offline_test_scores is
  'Phase 7 paper-test scores (D-059). Feeds Phase 8 mastery + parents'' weekly report. Upsert key = (batch, student, test_name, test_date).';
