-- Phase 6 CP1 — questions, question_options, question_solutions.
--
-- The question bank is shared across practice quizzes (Phase 6) and graded
-- exams (Phase 7). Items are scoped by topic; difficulty is optional metadata
-- for the picker. Question prompts may contain KaTeX (rendered client-side)
-- and an optional image stored in the `exam-images` bucket (CP7) under
-- `prompt_image_path` / `image_path`. RLS lives in 20260519101000.

create table public.questions (
  id                 uuid primary key default gen_random_uuid(),
  topic_id           uuid not null references public.topics(id) on delete restrict,
  prompt_md          text not null check (char_length(prompt_md) between 1 and 5000),
  prompt_image_path  text,
  difficulty         text check (difficulty in ('easy','medium','hard')),
  created_by         uuid not null references public.app_users(id),
  is_archived        boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index questions_topic_active_idx on public.questions (topic_id) where is_archived = false;
create index questions_created_by_idx   on public.questions (created_by);
create index questions_difficulty_idx   on public.questions (difficulty) where is_archived = false;

create table public.question_options (
  id          uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  text_md     text not null check (char_length(text_md) <= 1000),
  image_path  text,
  is_correct  boolean not null default false,
  sort_order  int     not null default 0 check (sort_order between 0 and 99),
  created_at  timestamptz not null default now(),
  -- An option must carry at least text or an image; empty options are nonsense.
  check (char_length(trim(text_md)) > 0 or image_path is not null)
);

create index question_options_qid_idx on public.question_options (question_id, sort_order);

-- Cheap server-side guard: a question must have at least 1 correct option.
-- Enforced at write time via the edge fn (quiz-builder publish + admin
-- moderation); a deferred trigger here would slow inserts and force callers
-- to wrap multi-statement updates in transactions. Leaving validation to the
-- edge fn matches D-103.

create table public.question_solutions (
  question_id        uuid primary key references public.questions(id) on delete cascade,
  explanation_md     text not null check (char_length(explanation_md) between 1 and 10000),
  related_content_id uuid references public.content_items(id) on delete set null,
  updated_at         timestamptz not null default now()
);

create index question_solutions_related_content_idx
  on public.question_solutions (related_content_id) where related_content_id is not null;

-- updated_at triggers (D-166: every new public trigger fn pins search_path).

create or replace function public._questions_updated_at() returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke execute on function public._questions_updated_at() from public, anon, authenticated;
grant  execute on function public._questions_updated_at() to service_role;

create trigger questions_updated_at_trg
  before update on public.questions
  for each row execute function public._questions_updated_at();

create or replace function public._question_solutions_updated_at() returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke execute on function public._question_solutions_updated_at() from public, anon, authenticated;
grant  execute on function public._question_solutions_updated_at() to service_role;

create trigger question_solutions_updated_at_trg
  before update on public.question_solutions
  for each row execute function public._question_solutions_updated_at();

comment on table public.questions is
  'Phase 6 question bank. RLS in 20260519101000_quiz_rls. Writes go through quiz-builder + admin paths; reads scoped by edge fn during attempts so is_correct never reaches the student client.';
comment on table public.question_options is
  'Phase 6 option text. is_correct must NEVER reach the student client during an active attempt — RLS blocks student SELECT entirely (D-103); quiz-start sanitises the payload.';
comment on table public.question_solutions is
  'Per-question explanation + optional related_content_id (Phase 5 video/pdf). Read after quiz-submit only.';
