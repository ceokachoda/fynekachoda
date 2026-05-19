-- Phase 6 CP2 — quizzes, quiz_questions, quiz_attempts, quiz_answers.
--
-- Self-paced practice quizzes (D-051). Per-quiz marking scheme (D-053).
-- Question/option order randomisation snapshot lives in quiz_attempts.metadata
-- so a refresh / app kill resumes in the same order. Attempts are immutable
-- once submitted (submitted_at IS NOT NULL); a retake creates a new row.

create table public.quizzes (
  id                  uuid primary key default gen_random_uuid(),
  title               text not null check (char_length(title) between 1 and 200),
  topic_id            uuid references public.topics(id) on delete restrict,
  chapter_id          uuid references public.chapters(id) on delete restrict,
  batch_id            uuid references public.batches(id) on delete cascade,
  course_id           uuid not null references public.courses(id) on delete restrict,
  duration_min        int  not null default 20 check (duration_min between 1 and 240),
  marks_correct       numeric(6,2) not null default 4   check (marks_correct  > 0),
  marks_wrong         numeric(6,2) not null default -1  check (marks_wrong   <= 0),
  marks_skip          numeric(6,2) not null default 0   check (marks_skip    <= 0),
  randomize_questions boolean not null default true,
  randomize_options   boolean not null default true,
  is_published        boolean not null default false,
  created_by          uuid not null references public.app_users(id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  check (topic_id is not null or chapter_id is not null)
);

create index quizzes_topic_published_idx   on public.quizzes (topic_id,   is_published) where topic_id   is not null;
create index quizzes_chapter_published_idx on public.quizzes (chapter_id, is_published) where chapter_id is not null;
create index quizzes_batch_idx             on public.quizzes (batch_id) where batch_id is not null;
create index quizzes_course_published_idx  on public.quizzes (course_id, is_published);
create index quizzes_created_by_idx        on public.quizzes (created_by);

create or replace function public._quizzes_updated_at() returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke execute on function public._quizzes_updated_at() from public, anon, authenticated;
grant  execute on function public._quizzes_updated_at() to service_role;

create trigger quizzes_updated_at_trg
  before update on public.quizzes
  for each row execute function public._quizzes_updated_at();

create table public.quiz_questions (
  quiz_id     uuid not null references public.quizzes(id)   on delete cascade,
  question_id uuid not null references public.questions(id) on delete restrict,
  sort_order  int  not null default 0 check (sort_order between 0 and 9999),
  added_at    timestamptz not null default now(),
  primary key (quiz_id, question_id)
);

create index quiz_questions_question_idx on public.quiz_questions (question_id);

create table public.quiz_attempts (
  id              uuid primary key default gen_random_uuid(),
  quiz_id         uuid not null references public.quizzes(id) on delete cascade,
  student_id      uuid not null references public.students(user_id) on delete cascade,
  started_at      timestamptz not null default now(),
  submitted_at    timestamptz,
  is_auto_submit  boolean not null default false,
  score           numeric(8,2),
  max_score       numeric(8,2),
  correct_count   int,
  wrong_count     int,
  skipped_count   int,
  is_practice     boolean not null default true,
  -- {"question_order":["q-uuid",...], "option_order":{"q-uuid":["opt-uuid",...]}}
  metadata        jsonb   not null default '{}'::jsonb,
  check (
    submitted_at is null
    or (
      submitted_at >= started_at
      and score is not null and max_score is not null
      and correct_count is not null and wrong_count is not null and skipped_count is not null
    )
  )
);

create index quiz_attempts_student_submitted_idx on public.quiz_attempts (student_id, submitted_at desc);
create index quiz_attempts_quiz_idx              on public.quiz_attempts (quiz_id, submitted_at desc);
-- Idempotency lookup for in-flight attempts (a 60s double-tap window).
create index quiz_attempts_active_idx on public.quiz_attempts (student_id, quiz_id)
  where submitted_at is null;

create table public.quiz_answers (
  attempt_id         uuid not null references public.quiz_attempts(id) on delete cascade,
  question_id        uuid not null references public.questions(id) on delete restrict,
  selected_option_id uuid references public.question_options(id) on delete set null,
  is_flagged         boolean not null default false,
  answered_at        timestamptz,
  primary key (attempt_id, question_id)
);

create index quiz_answers_attempt_idx on public.quiz_answers (attempt_id);

comment on table public.quizzes is
  'Phase 6 self-paced practice quizzes. RLS in 20260519101000_quiz_rls. Live edits propagate to in-flight attempts (acceptable for practice; exams snapshot per Phase 7).';
comment on table public.quiz_questions is 'Junction; questions are pulled from the bank (D-057).';
comment on table public.quiz_attempts  is 'One row per attempt. metadata stores per-attempt question + option order snapshot for resume.';
comment on table public.quiz_answers   is 'Per-question response within an attempt. Auto-saved on each option select / flag.';
