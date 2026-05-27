-- Phase 10 CP1 — badges catalogue + badge_earnings (sticky, D-076).
--
-- `badges` is a public read-only catalogue (any authenticated may read).
-- `badge_earnings` reads = student-own + teacher-batch + admin (mirrors the Phase 8
-- mastery/streaks 3-policy union shape, D-029/D-152). Writes happen ONLY through the
-- SECURITY DEFINER evaluator/rollover fns + service role, so there is NO client
-- insert/delete policy (RLS default-denies them). Students may flip ONLY `is_seen`
-- on their own rows to dismiss a celebration — enforced by a column-level UPDATE
-- grant + an own-row UPDATE policy. RLS helpers live in `private` (D-146).

create table public.badges (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  name        text not null,
  description text not null,
  icon_path   text not null,
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now()
);

create table public.badge_earnings (
  student_id  uuid not null references public.students(user_id) on delete cascade,
  badge_id    uuid not null references public.badges(id) on delete cascade,
  earned_at   timestamptz not null default now(),
  is_seen     boolean not null default false,
  primary key (student_id, badge_id)
);

-- Hot path: "any unseen badge for me?" (celebration poll on app focus).
create index badge_earnings_unseen_idx on public.badge_earnings (student_id) where is_seen = false;
-- "last 3 earned" (dashboard recent-badges strip).
create index badge_earnings_recent_idx on public.badge_earnings (student_id, earned_at desc);

alter table public.badges        enable row level security;
alter table public.badge_earnings enable row level security;

-- ── badges: public catalogue ──────────────────────────────────────────────────
create policy badges_read on public.badges
  for select to authenticated using (true);

-- ── badge_earnings: 3-policy read union (own / teacher-batch / admin) ──────────
create policy be_self on public.badge_earnings
  for select to authenticated
  using (student_id = private.current_app_user_id());

create policy be_teacher on public.badge_earnings
  for select to authenticated
  using (
    private.has_role('teacher')
    and student_id in (
      select s.user_id from public.students s
      where s.batch_id in (
        select bt.batch_id from public.batch_teachers bt
        where bt.teacher_id = private.current_app_user_id()
      )
    )
  );

create policy be_admin on public.badge_earnings
  for select to authenticated
  using (private.is_admin());

-- Students dismiss their own celebration by flipping is_seen. The own-row policy
-- gates WHICH rows; the column grant below gates WHICH column (is_seen only).
create policy be_self_seen on public.badge_earnings
  for update to authenticated
  using (student_id = private.current_app_user_id())
  with check (student_id = private.current_app_user_id());

revoke update on public.badge_earnings from authenticated;
grant  update (is_seen) on public.badge_earnings to authenticated;

-- ── Seed the 11-badge starter catalogue (spec §5.1 / D-077) ───────────────────
-- icon_path → objects in the private `badge-assets` bucket (created in CP7).
insert into public.badges (code, name, description, icon_path, sort_order) values
  ('first_quiz',              'First Step',         'Submit your first practice quiz',                      'badges/first_quiz.svg',   0),
  ('streak_7',                'Week Warrior',       'Reach a 7-day active streak',                          'badges/streak_7.svg',     1),
  ('streak_30',               'Marathoner',         'Reach a 30-day active streak',                         'badges/streak_30.svg',    2),
  ('streak_90',               'Iron Mind',          'Reach a 90-day active streak',                         'badges/streak_90.svg',    3),
  ('perfect_week_attendance', 'Showed Up',          '100% attendance across 7 consecutive class days',      'badges/perfect_week.svg', 4),
  ('topper_of_week',          'Top of the Class',   'Finish #1 on your weekly batch leaderboard',           'badges/topper.svg',       5),
  ('runner_up_week',          'So Close',           'Finish #2 or #3 on your weekly batch leaderboard',     'badges/runner_up.svg',    6),
  ('quiz_100',                'Centurion',          'Submit 100 practice quizzes',                          'badges/quiz_100.svg',     7),
  ('mastery_80_subject',      'Subject Specialist', 'Average 80%+ mastery across a subject (min 3 topics)', 'badges/mastery_80.svg',   8),
  ('early_bird',              'Early Bird',         'Scan in before the scheduled start 5 times',           'badges/early_bird.svg',   9),
  ('comeback',                'Comeback',           'Rebuild a 7-day streak after losing a 7+ day streak',  'badges/comeback.svg',    10);
