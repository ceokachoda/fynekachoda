# Backend Architecture

Supabase-first. One Postgres database, RLS-enforced, with Auth, Storage, Realtime, and Edge Functions on the same platform. Two projects: `fynestudy-dev` and `fynestudy-prod`, both in `ap-south-1` (Mumbai). Mobile app and admin panel both talk to the same backend.

---

## 1. Topology

```
                                                                ┌──────────────────────────┐
                                                                │  Mobile (Expo, RN)       │
                                                                │  Student + Teacher       │
                                                                └────────────┬─────────────┘
                                                                             │ HTTPS + WS
┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐           │
│ YouTube Data API │   │ Gupshup WA API   │   │ Sentry + PostHog │           │
└────────┬─────────┘   └────────┬─────────┘   └────────┬─────────┘           │
         │                      │                      │                      │
         └─────────┬────────────┴───────────┬──────────┘                      │
                   │                        │                                 │
        ┌──────────▼────────────────────────▼──────────────────┐              │
        │           Supabase Edge Functions (Deno)             ◀──────────────┤
        │  yt-broadcast-create, yt-playback-sign,              │              │
        │  attendance-qr-sign, attendance-qr-verify,           │              │
        │  exam-submit, mastery-recompute, streak-recompute,   │              │
        │  whatsapp-send, parent-report-generate, gupshup-cb   │              │
        └──────────┬───────────────────────────────────────────┘              │
                   │ service-role JWT                                         │
        ┌──────────▼─────────────────────────────────────────────────────────▼──┐
        │                            Supabase                                   │
        │   ┌──────────┐  ┌────────────┐  ┌──────────┐  ┌─────────┐  ┌──────┐ │
        │   │ Postgres │  │ Auth (JWT) │  │ Storage  │  │Realtime │  │Vault │ │
        │   └──────────┘  └────────────┘  └──────────┘  └─────────┘  └──────┘ │
        └────────────────────────────────────────────────────────────────────────┘
                   ▲
                   │ HTTPS
        ┌──────────┴─────────────┐
        │   Admin Panel          │
        │   Next.js on Vercel    │
        └────────────────────────┘
```

Clients **never** call YouTube, Gupshup, Sentry, or PostHog directly with credentials. They talk only to Supabase (anon key) and the edge functions (anon JWT). Service-role keys live only in edge functions.

## 2. Environments

| Env | Supabase project | Domain | Mobile build channel | Notes |
|---|---|---|---|---|
| Local | local Docker (`supabase start`) | `localhost` | n/a | For developer machines |
| Dev | `fynestudy-dev` | `dev-admin.fynestudy.in` | `development` | Auto-deploy from `main`. Shared by all devs. |
| Prod | `fynestudy-prod` | `admin.fynestudy.in` | `production` | Manual promotion via tagged release |

Both Supabase projects in `ap-south-1`. Branching (`supabase branch create`) used for migration previews on PRs.

## 3. Database Schema

> SQL below is illustrative. Final migrations live under `supabase/migrations/`. Every table uses UUIDs (`gen_random_uuid()`), `created_at` and `updated_at` (`timestamptz`), and soft-delete where indicated.

> **Status note (last sweep 2026-05-18, Phase 4 CP13):** §3.1 Identity, §3.2 Courses & Batches, §3.3 Sessions & Attendance, §3.9 Audit Log, and §3.10 MFA Recovery Codes are all **applied** to the dev project (`orqwyazvcthgxoadfxfv`). RLS for every applied table is on (see callouts inside each section). Two QR rate-limit tables (`qr_sign_attempts`, `qr_verify_attempts`) and one materializer (`public.materialize_sessions(p_window_days int)` + nightly `pg_cron`) are also applied — see §3.3 callouts.
>
> Applied migrations, in order:
> - `20260514115416_init` — empty placeholder (Phase 1).
> - `20260514164704_init_users_roles` — `app_users`, `user_roles`, `students`, `teachers`, `set_updated_at` trigger.
> - `20260514165311_auth_helpers_rls` — helper functions + RLS baseline.
> - `20260514165545_harden_auth_helper_schema` — moves the RLS helpers to a `private` schema per **D-146** (resolves advisor lints 0028/0029). The body of §5.2 below is **superseded** by this migration; use `private.is_admin()`, `private.has_role()`, `private.current_app_user_id()` in any new policies.
> - `20260514170336_audit_log` — audit_log table + admin-read policy.
> - `20260515063322_courses_batches` (Phase 3 CP1) — courses + subjects + chapters + topics + batches + batch_teachers + batch_schedule + seed data.
> - `20260515063821_students_batch_required` (Phase 3 CP2) — backfill + `students.batch_id NOT NULL`.
> - `20260515064428_batch_rls` (Phase 3 CP3) — RLS on the seven Phase 3 tables; teacher batch-scope read on `students`.
> - `20260515121845_teacher_app_users_read` (Phase 3 CP10) — adds `app_users_teacher_batch_read` so a teacher can resolve student `full_name` when embedding `students(app_users!user_id(full_name))`. Closes the silent-null bug discovered when the teacher batch-detail roster on mobile rendered "—" for every name.
> - `20260515132622_mfa_recovery_codes` (Phase 3 CP11) — `mfa_recovery_codes` table + RLS (self-read of own hashed rows, admin all). Powers the `mfa-codes-issue` / `mfa-codes-consume` edge functions.
> - `20260515152721_sessions_attendance` (Phase 4 CP1) — `sessions`, `attendance`, `attendance_corrections`, `activity_days`. Unique `(session_id, student_id)` on `attendance` enforces no duplicates.
> - `20260515155135_attendance_rls` (Phase 4 CP2) — RLS on the four Phase 4 tables: student-self / teacher-batch / admin on reads; **no INSERT/UPDATE policy for `authenticated`** — writes go through edge fns under `service_role`.
> - `20260515160609_qr_secret_accessor` (Phase 4 CP3) — `private.get_qr_secret(version int)` reads the HMAC secret from Supabase Vault. Locked to `service_role`.
> - `20260515194546_qr_sign_attempts` (Phase 4 CP4) — `qr_sign_attempts` rate-limit table + `private.try_qr_sign(p_student uuid, p_session uuid)` SECURITY DEFINER RPC (1 / 5 s per `(student_id, session_id)` per **D-115**).
> - `20260515214940_qr_verify_attempts` (Phase 4 CP5) — `qr_verify_attempts` rate-limit table + `private.try_qr_verify(p_teacher uuid)` SECURITY DEFINER RPC (2 / s per teacher per **D-115**).
> - `20260515220836_materialize_sessions` (Phase 4 CP7) — `public.materialize_sessions(p_window_days int)` DB function + nightly `pg_cron` job `materialize-sessions-nightly` at `0 0 * * *` UTC. Idempotent on re-run.
> - `20260515221227_realtime_attendance` (Phase 4 CP8) — adds `public.attendance` to the `supabase_realtime` publication so the teacher roster screen and student dashboard receive CDC INSERT events under RLS scope.
>
> Other §3 sections (content, quizzes, exams, mastery, parent reports) are **target schema** — they land in Phases 5 through 9. When this doc disagrees with the applied migrations, **the migrations win**.

### 3.1 Identity

```sql
-- Mirrors Supabase auth.users with our domain fields.
create table public.app_users (
  id            uuid primary key default gen_random_uuid(),
  auth_user_id  uuid not null unique references auth.users(id) on delete cascade,
  full_name     text not null,
  email         text not null unique,
  phone         text,
  dob           date,
  gender        text check (gender in ('male', 'female', 'other', 'prefer_not')),
  avatar_path   text,                                     -- Storage path in profile-pictures bucket
  is_active     boolean not null default true,
  suspended_at  timestamptz,
  suspended_reason text,
  must_change_password boolean not null default true,     -- first-login flip
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table public.user_roles (
  user_id  uuid not null references public.app_users(id) on delete cascade,
  role     text not null check (role in ('student', 'teacher', 'staff_admin', 'owner_admin')),
  granted_at timestamptz not null default now(),
  granted_by uuid references public.app_users(id),
  primary key (user_id, role)
);

-- Student profile extension
create table public.students (
  user_id          uuid primary key references public.app_users(id) on delete cascade,
  batch_id         uuid not null references public.batches(id),
  enrollment_no    text unique,
  school_name      text,
  board            text,
  current_class    text,                                  -- "11", "12", "Dropper"
  address          text,
  parent_phone_1   text,
  parent_phone_2   text,
  parent_consent_at timestamptz,
  parent_consent_method text,                             -- "verbal", "written", "form"
  parent_consent_by uuid references public.app_users(id),  -- admin who attested
  joined_at        timestamptz not null default now(),
  graduated_at     timestamptz
);

create table public.teachers (
  user_id  uuid primary key references public.app_users(id) on delete cascade,
  subjects text[] not null default '{}',                  -- e.g., {'physics','mathematics'}
  bio      text
);
```

**Applied RLS on `app_users` (Phase 2 + CP10 addendum):**

- `app_users_self_read` — `auth_user_id = auth.uid()`.
- `app_users_admin_all` — `private.is_admin()`.
- `app_users_teacher_batch_read` (CP10 fix) — teachers may read app_users rows for students in their assigned batches. Required so that the mobile batch-detail roster query embeds `students(app_users!user_id(full_name))` without RLS-filtering the join target to null. Locked in by `test-rls.ts` Tests 14 + 15 (own-batch read succeeds; cross-batch read denied).

### 3.2 Courses & Batches

```sql
create table public.courses (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,                       -- "JEE_MAIN", "NEET_UG", etc.
  name        text not null,
  description text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create table public.subjects (
  id         uuid primary key default gen_random_uuid(),
  course_id  uuid not null references public.courses(id) on delete cascade,
  name       text not null,
  sort_order int not null default 0,
  unique (course_id, name)
);

create table public.chapters (
  id         uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects(id) on delete cascade,
  name       text not null,
  sort_order int not null default 0,
  unique (subject_id, name)
);

create table public.topics (
  id         uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references public.chapters(id) on delete cascade,
  name       text not null,
  sort_order int not null default 0,
  unique (chapter_id, name)
);

create table public.batches (
  id           uuid primary key default gen_random_uuid(),
  course_id    uuid not null references public.courses(id),
  name         text not null,                             -- "NEET 2027 Morning"
  starts_on    date not null,
  ends_on      date,
  capacity     int not null default 80,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);

create table public.batch_teachers (
  batch_id   uuid not null references public.batches(id) on delete cascade,
  teacher_id uuid not null references public.teachers(user_id) on delete cascade,
  primary key (batch_id, teacher_id)
);

-- Recurring schedule per batch (RFC 5545–style rule, simplified)
create table public.batch_schedule (
  id         uuid primary key default gen_random_uuid(),
  batch_id   uuid not null references public.batches(id) on delete cascade,
  weekday    int not null check (weekday between 0 and 6),  -- 0 = Sunday
  start_time time not null,                                  -- IST
  end_time   time not null,
  subject_id uuid references public.subjects(id),            -- optional default subject
  is_active  boolean not null default true
);
```

### 3.3 Sessions (class meetings) & Attendance

A **session** is one occurrence of a batch meeting — either auto-materialized from `batch_schedule` or created ad-hoc.

```sql
create table public.sessions (
  id           uuid primary key default gen_random_uuid(),
  batch_id     uuid not null references public.batches(id),
  subject_id   uuid references public.subjects(id),
  scheduled_start timestamptz not null,
  scheduled_end   timestamptz not null,
  is_ad_hoc    boolean not null default false,
  is_live_class boolean not null default false,            -- true = has YT broadcast attached
  yt_broadcast_id text,                                    -- server-only; never serialized to client
  yt_video_id     text,                                    -- server-only
  status       text not null default 'scheduled' check (status in ('scheduled','live','ended','cancelled')),
  started_at   timestamptz,
  ended_at     timestamptz,
  created_by   uuid references public.app_users(id),
  created_at   timestamptz not null default now()
);

create table public.attendance (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.sessions(id) on delete cascade,
  student_id  uuid not null references public.students(user_id) on delete cascade,
  status      text not null check (status in ('present','late','absent')),
  method      text not null check (method in ('qr','manual','correction')),
  marked_at   timestamptz not null default now(),
  marked_by   uuid references public.app_users(id),       -- teacher who scanned/marked
  qr_token_jti text,                                      -- JWT id, for replay protection
  notes       text,
  unique (session_id, student_id)                         -- enforces no duplicates
);

-- Audit trail for attendance corrections (admin/teacher post-hoc changes)
create table public.attendance_corrections (
  id            uuid primary key default gen_random_uuid(),
  attendance_id uuid not null references public.attendance(id) on delete cascade,
  prev_status   text not null,
  new_status    text not null,
  reason        text not null,
  changed_by    uuid not null references public.app_users(id),
  changed_at    timestamptz not null default now()
);
```

### 3.4 Question Bank, Quizzes, Exams

```sql
create table public.questions (
  id          uuid primary key default gen_random_uuid(),
  topic_id    uuid not null references public.topics(id),
  prompt_md   text not null,                              -- Markdown with KaTeX
  prompt_image_path text,                                 -- optional Storage path
  difficulty  text check (difficulty in ('easy','medium','hard')),
  created_by  uuid not null references public.app_users(id),
  is_archived boolean not null default false,
  created_at  timestamptz not null default now()
);

create table public.question_options (
  id          uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  text_md     text not null,
  is_correct  boolean not null default false,
  sort_order  int not null default 0
);

create table public.question_solutions (
  question_id uuid primary key references public.questions(id) on delete cascade,
  explanation_md text not null,
  related_content_id uuid references public.content_items(id)  -- "Related video" link
);

-- Practice quiz (self-paced)
create table public.quizzes (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  topic_id      uuid references public.topics(id),         -- scoped to topic (preferred) or chapter
  chapter_id    uuid references public.chapters(id),
  batch_id      uuid references public.batches(id),        -- visibility scope
  duration_min  int not null default 20,
  marks_correct numeric not null default 4,
  marks_wrong   numeric not null default -1,
  marks_skip    numeric not null default 0,
  randomize_questions boolean not null default true,
  randomize_options   boolean not null default true,
  is_published  boolean not null default false,
  created_by    uuid not null references public.app_users(id),
  created_at    timestamptz not null default now()
);

create table public.quiz_questions (
  quiz_id     uuid not null references public.quizzes(id) on delete cascade,
  question_id uuid not null references public.questions(id),
  sort_order  int not null default 0,
  primary key (quiz_id, question_id)
);

create table public.quiz_attempts (
  id           uuid primary key default gen_random_uuid(),
  quiz_id      uuid not null references public.quizzes(id),
  student_id   uuid not null references public.students(user_id),
  started_at   timestamptz not null default now(),
  submitted_at timestamptz,
  score        numeric,
  max_score    numeric,
  is_practice  boolean not null default true,
  metadata     jsonb not null default '{}'::jsonb         -- option ordering snapshot, etc.
);

create table public.quiz_answers (
  attempt_id      uuid not null references public.quiz_attempts(id) on delete cascade,
  question_id     uuid not null references public.questions(id),
  selected_option_id uuid references public.question_options(id),
  is_flagged      boolean not null default false,
  answered_at     timestamptz,
  primary key (attempt_id, question_id)
);

-- Graded exam (teacher-scheduled, server-enforced timer)
create table public.exams (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  batch_id        uuid not null references public.batches(id),
  starts_at       timestamptz not null,
  duration_min    int not null,
  marks_correct   numeric not null default 4,
  marks_wrong     numeric not null default -1,
  marks_skip      numeric not null default 0,
  randomize_questions boolean not null default true,
  randomize_options   boolean not null default true,
  result_release  text not null default 'manual' check (result_release in ('instant','manual')),
  results_released_at timestamptz,
  is_published    boolean not null default false,
  created_by      uuid not null references public.app_users(id),
  created_at      timestamptz not null default now()
);

create table public.exam_questions (
  exam_id     uuid not null references public.exams(id) on delete cascade,
  question_id uuid not null references public.questions(id),
  sort_order  int not null default 0,
  primary key (exam_id, question_id)
);

create table public.exam_attempts (
  id              uuid primary key default gen_random_uuid(),
  exam_id         uuid not null references public.exams(id),
  student_id      uuid not null references public.students(user_id),
  started_at      timestamptz not null default now(),
  submitted_at    timestamptz,
  auto_submitted  boolean not null default false,
  tab_switch_count int not null default 0,
  score           numeric,
  max_score       numeric,
  unique (exam_id, student_id)
);

create table public.exam_answers (
  attempt_id      uuid not null references public.exam_attempts(id) on delete cascade,
  question_id     uuid not null references public.questions(id),
  selected_option_id uuid references public.question_options(id),
  is_flagged      boolean not null default false,
  answered_at     timestamptz,
  primary key (attempt_id, question_id)
);

-- Offline pen-paper test scores
create table public.offline_test_scores (
  id            uuid primary key default gen_random_uuid(),
  batch_id      uuid not null references public.batches(id),
  student_id    uuid not null references public.students(user_id),
  test_name     text not null,
  test_date     date not null,
  subject_id    uuid references public.subjects(id),
  score         numeric not null,
  max_score     numeric not null,
  notes         text,
  entered_by    uuid not null references public.app_users(id),
  entered_at    timestamptz not null default now()
);
```

### 3.5 Content Library

```sql
create table public.content_items (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in ('video','pdf','note')),
  title       text not null,
  topic_id    uuid not null references public.topics(id),
  batch_id    uuid references public.batches(id),         -- null = course-wide
  course_id   uuid not null references public.courses(id), -- denormalized for quick filtering
  yt_video_id text,                                       -- server-only for kind='video'
  file_path   text,                                       -- Storage path for kind in ('pdf','note')
  duration_sec int,                                       -- for kind='video'
  uploaded_by uuid not null references public.app_users(id),
  is_published boolean not null default true,
  created_at  timestamptz not null default now()
);
```

### 3.6 Live Class Chat

Backed by Supabase Realtime broadcast + Postgres for persistence.

```sql
create table public.chat_messages (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.sessions(id) on delete cascade,
  author_id   uuid not null references public.app_users(id),
  body        text not null check (length(body) between 1 and 500),
  is_deleted  boolean not null default false,
  deleted_by  uuid references public.app_users(id),
  deleted_at  timestamptz,
  posted_at   timestamptz not null default now()
);

create table public.raise_hand_events (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.sessions(id) on delete cascade,
  student_id  uuid not null references public.students(user_id),
  raised_at   timestamptz not null default now(),
  resolved_at timestamptz
);

create table public.chat_bans (
  session_id uuid not null references public.sessions(id) on delete cascade,
  user_id    uuid not null references public.app_users(id),
  banned_at  timestamptz not null default now(),
  banned_by  uuid not null references public.app_users(id),
  primary key (session_id, user_id)
);
```

### 3.7 Mastery, Leaderboard, Gamification

```sql
-- Materialized per (student, topic). Recomputed on every attempt + nightly.
create table public.mastery (
  student_id  uuid not null references public.students(user_id) on delete cascade,
  topic_id    uuid not null references public.topics(id) on delete cascade,
  mastery_pct numeric not null,                           -- 0..100
  attempt_count int not null,
  last_attempt_at timestamptz,
  updated_at  timestamptz not null default now(),
  primary key (student_id, topic_id)
);

-- Streak state per student
create table public.streaks (
  student_id   uuid primary key references public.students(user_id) on delete cascade,
  current_days int not null default 0,
  best_days    int not null default 0,
  last_active  date,
  updated_at   timestamptz not null default now()
);

-- Active-day log (1 row per student per day)
create table public.activity_days (
  student_id uuid not null references public.students(user_id) on delete cascade,
  day        date not null,
  primary key (student_id, day)
);

create table public.badges (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,                       -- "first_quiz", "streak_7", etc.
  name        text not null,
  description text not null,
  icon_path   text not null
);

create table public.badge_earnings (
  student_id  uuid not null references public.students(user_id) on delete cascade,
  badge_id    uuid not null references public.badges(id),
  earned_at   timestamptz not null default now(),
  primary key (student_id, badge_id)
);

-- View, refreshed by leaderboard query (no materialized table needed at 600 students)
create view public.leaderboard_weekly as
select
  s.user_id as student_id,
  s.batch_id,
  coalesce(avg(qa.score / nullif(qa.max_score, 0)), 0) as score_norm,
  coalesce((count(distinct ad.day)::numeric / 7), 0)  as attendance_norm,
  coalesce(least(st.current_days::numeric / 30, 1), 0) as streak_norm,
  (0.6 * coalesce(avg(qa.score / nullif(qa.max_score, 0)), 0)
   + 0.25 * coalesce((count(distinct ad.day)::numeric / 7), 0)
   + 0.15 * coalesce(least(st.current_days::numeric / 30, 1), 0)) as composite
from public.students s
left join public.quiz_attempts qa
  on qa.student_id = s.user_id
  and qa.submitted_at >= now() - interval '7 days'
left join public.activity_days ad
  on ad.student_id = s.user_id
  and ad.day >= (current_date - interval '7 days')::date
left join public.streaks st on st.student_id = s.user_id
group by s.user_id, s.batch_id, st.current_days;
```

### 3.8 Parent Reports & WhatsApp

```sql
create table public.parent_reports (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references public.students(user_id),
  period_start date not null,
  period_end   date not null,
  pdf_path     text not null,                             -- Storage path in generated-pdfs
  generated_at timestamptz not null default now(),
  unique (student_id, period_start, period_end)
);

create table public.whatsapp_messages (
  id          uuid primary key default gen_random_uuid(),
  recipient_phone text not null,
  template_code   text not null,                          -- approved Gupshup template
  payload     jsonb not null,
  related_report_id uuid references public.parent_reports(id),
  status      text not null default 'queued' check (status in ('queued','sent','delivered','read','failed')),
  provider_message_id text,
  error       text,
  queued_at   timestamptz not null default now(),
  sent_at     timestamptz,
  delivered_at timestamptz
);
```

### 3.9 Audit Log

```sql
create table public.audit_log (
  id          uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.app_users(id),
  actor_role   text,
  action       text not null,                             -- "create", "update", "delete", "release_results", etc.
  entity_table text not null,
  entity_id    text,
  before_data  jsonb,
  after_data   jsonb,
  ip_address   inet,
  user_agent   text,
  occurred_at  timestamptz not null default now()
);
```

Applied action vocabulary (as of Phase 4 CP13): `create_user`, `update_user`, `suspend`, `unsuspend`, `force_reset_password`, `password_changed`, `create_course` / `update_course` / `delete_course`, `create_subject` / `update_subject` / `delete_subject`, `create_chapter` / `update_chapter` / `delete_chapter`, `create_topic` / `update_topic` / `delete_topic`, `create_batch` / `update_batch` / `delete_batch`, `assign_teacher_to_batch` / `unassign_teacher_from_batch`, `create_schedule_row` / `delete_schedule_row`, `transfer_student`, `mfa_codes_issued`, `mfa_codes_consumed`, `attendance_marked` (via QR verify), `attendance_manual_marked`, `attendance_corrected`, `attendance_bulk_mark`, `attendance_unmarked`, `session_created_ad_hoc`.

### 3.10 MFA Recovery Codes (Phase 3 CP11)

```sql
create table public.mfa_recovery_codes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.app_users(id) on delete cascade,
  code_hash   text not null,                              -- SHA-256 hex of normalised plaintext
  used_at     timestamptz,                                -- null = unused; non-null = consumed
  created_at  timestamptz not null default now()
);

create index mfa_recovery_codes_user_idx on public.mfa_recovery_codes (user_id);
create unique index mfa_recovery_codes_user_hash_uniq
  on public.mfa_recovery_codes (user_id, code_hash);
```

- **Plaintext is shown to the user exactly once** by `mfa-codes-issue` and never stored. Codes are 10 chars from a 31-char ambiguity-stripped alphabet (no `0`/`1`/`i`/`l`/`o`), rendered `XXXXX-XXXXX`.
- **Issue** replaces any existing batch for the user (delete-then-insert). Each enrollment yields a fresh 10-code batch.
- **Consume** marks the row `used_at = now()` and immediately calls the GoTrue admin API to delete every verified TOTP factor on the user. Middleware then routes the user through Stage A → `/2fa/enroll` to re-enroll, where a new batch of codes is issued.
- **Audit:** `mfa_codes_issued` (after `{count: 10}`) and `mfa_codes_consumed` (after `{used_at, factors_deleted}`).
- **RLS:** `mfa_recovery_self_read` lets a user see their own hashed rows (used as a "you have N unused" hint in future settings UI); `mfa_recovery_admin_all` lets admins read/delete; service-role bypasses both. There is no INSERT/UPDATE policy for `authenticated` — code issuance only happens via the edge function. Locked in by `test-rls.ts` Tests 16 + 17.

## 4. Indexes (Performance)

Defined in migration `0014_indexes_perf.sql`. Highlights:

- `attendance(session_id)` and `attendance(student_id, marked_at desc)`
- `sessions(batch_id, scheduled_start)` for schedule queries
- `quiz_attempts(student_id, submitted_at desc)` for dashboard
- `exam_attempts(exam_id, student_id)` unique (already enforced)
- `mastery(student_id)` for dashboard load
- `audit_log(occurred_at desc)` and `audit_log(entity_table, entity_id)`
- `whatsapp_messages(status, queued_at)` for retry workers
- Partial index on `chat_messages(session_id, posted_at)` where `is_deleted = false`

## 5. RLS Strategy

**Baseline:** every user-data table has RLS on. The Supabase **anon key** can read nothing; the **authenticated** role gets policies per table. The **service-role** key (edge functions only) bypasses RLS.

Helper functions:

```sql
create or replace function public.current_app_user_id()
returns uuid language sql stable as $$
  select id from public.app_users where auth_user_id = auth.uid();
$$;

create or replace function public.has_role(r text)
returns boolean language sql stable as $$
  select exists (
    select 1 from public.user_roles
    where user_id = public.current_app_user_id() and role = r
  );
$$;

create or replace function public.is_admin()
returns boolean language sql stable as $$
  select public.has_role('owner_admin') or public.has_role('staff_admin');
$$;

create or replace function public.current_student_batch()
returns uuid language sql stable as $$
  select batch_id from public.students where user_id = public.current_app_user_id();
$$;
```

Example policies:

```sql
-- Students can read their own row; teachers in the same batch can read; admins all.
alter table public.students enable row level security;

create policy "students_self_read" on public.students
  for select to authenticated
  using (user_id = public.current_app_user_id());

create policy "teachers_read_batch_students" on public.students
  for select to authenticated
  using (
    public.has_role('teacher')
    and batch_id in (
      select bt.batch_id from public.batch_teachers bt
      where bt.teacher_id = public.current_app_user_id()
    )
  );

create policy "admins_all_students" on public.students
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Attendance: student reads own; teacher reads their batches; admins all.
alter table public.attendance enable row level security;

create policy "attendance_student_self" on public.attendance
  for select to authenticated
  using (student_id = public.current_app_user_id());

create policy "attendance_teacher_batch" on public.attendance
  for select to authenticated
  using (
    public.has_role('teacher')
    and session_id in (
      select s.id from public.sessions s
      join public.batch_teachers bt on bt.batch_id = s.batch_id
      where bt.teacher_id = public.current_app_user_id()
    )
  );

-- Attendance writes only go through edge fn (`attendance-qr-verify`) using service-role.
-- We deliberately do NOT grant insert/update to authenticated.
```

Pattern repeats for every table. Edge functions perform privileged writes (attendance mark, exam submit, mastery recompute, audit log, etc.).

**Test strategy:** every RLS policy has a corresponding integration test in `apps/functions/_shared/rls.test.ts` that asserts (a) authorized read succeeds and (b) unauthorized read returns empty / forbidden.

## 6. Edge Functions

All edge functions are Deno, deployed via `supabase functions deploy`. Each function exports a single `serve` handler.

### 6.1 `auth-bootstrap`

- **Auth:** admin only (verifies JWT + role server-side).
- **Input:** `{ full_name, email, phone, batch_id, role }`
- **Action:** creates `auth.users` row via service-role admin API, creates `app_users` + `user_roles` + role-specific extension row (`students` / `teachers`), generates a temp password, emails it via Supabase Email Service. Sets `must_change_password = true`.
- **Audit:** writes `audit_log` entry.

### 6.2 `yt-broadcast-create`

- **Auth:** teacher (on their batches) or admin.
- **Input:** `{ session_id }`
- **Action:** uses institute's YouTube channel OAuth (refresh token stored in Supabase Vault) to call `liveBroadcasts.insert` + `liveStreams.insert`. Stores `yt_broadcast_id` and `yt_video_id` on `sessions`. Returns RTMP ingest info to the teacher's screen (for OBS or Streamlabs).
- **Privacy:** broadcast created as `unlisted`; chat disabled on YT side.

### 6.3 `yt-playback-sign`

- **Auth:** authenticated user with access to `session_id` (student in batch, teacher of batch, admin).
- **Input:** `{ session_id }`
- **Action:** verifies access via the same logic RLS would; emits a short-lived signed payload `{ yt_video_id, expires_at, watermark_text, jti }` with HMAC. The mobile client passes the payload to the wrapped player which:
  1. Verifies signature offline (public verification key shipped in app).
  2. Loads the YT video via the iframe player with `controls=0`, `modestbranding=1`.
  3. Renders watermark overlay using `watermark_text`.
- **Defense in depth:** the YT video ID *is* in the payload, so a sufficiently determined attacker with debug access can extract it. Mitigations: Unlisted videos rotated per class, watermarks identifying the leaker, audit log on every `yt-playback-sign` call.

### 6.4 `attendance-qr-sign`

- **Auth:** student.
- **Input:** `{ session_id }`
- **Action:** verifies that (a) the student is in the session's batch, (b) the current time is within the scan window (`scheduled_start - 15min` to `scheduled_end + 15min`), then emits an HMAC-signed payload `{ student_id, session_id, exp = now + 30s, jti }`. The student's app polls this every 25 seconds.
- **Rate limit:** 1 request / 5s per student.

### 6.5 `attendance-qr-verify`

- **Auth:** teacher (in the session's batch).
- **Input:** scanned QR payload + teacher's `session_id`.
- **Action:**
  1. Verify HMAC and freshness (`exp > now`).
  2. Verify session_id in payload matches teacher's session.
  3. Check `attendance` table: refuse if `(session_id, student_id)` already exists (replay).
  4. Determine status: `present` if before `scheduled_start + 10min`, `late` if before `scheduled_start + 30min`, else block with "too late".
  5. Insert `attendance` row with `method='qr'`, `qr_token_jti`, `marked_by = teacher`.
  6. Insert `activity_days` row for streak.
  7. Trigger `mastery-recompute` for the student (idempotent).
- **Rate limit:** 2 / second per teacher (allows fast-scan flow).

### 6.6 `exam-submit`

- **Auth:** student.
- **Input:** `{ exam_id, answers: [{ question_id, selected_option_id, is_flagged }] }`
- **Action:**
  1. Find or refuse `exam_attempt` row (started_at must exist; submitted_at must be null).
  2. **Server-side timer check.** If `now > exam.starts_at + exam.duration_min` → set `auto_submitted = true` regardless of client claim.
  3. Persist answers in `exam_answers`.
  4. Grade: for each `exam_questions` row, look up correct option, apply marking scheme.
  5. Update `exam_attempts` with `score`, `max_score`, `submitted_at`.
  6. Insert `activity_days` row.
  7. Trigger `mastery-recompute`.
  8. Audit.
- **Rate limit:** 1 / 2s per student per exam.

### 6.7 `mastery-recompute`

- **Auth:** internal (service-role) or admin.
- **Input:** `{ student_id, topic_ids? }`
- **Action:** for each topic, gather last N=5 attempts (combined quiz + exam), compute `avg(score_pct)`, upsert `mastery`.
- **Triggers:** post-write from `exam-submit`, post-write from quiz attempt, nightly cron for staleness sweep.

### 6.8 `streak-recompute`

- **Auth:** internal cron.
- **Schedule:** daily at 02:00 IST.
- **Action:** for each student, if they had `activity_days` entry yesterday → increment streak; otherwise → reset to 0. Compute `best_days`. Award streak badges (`streak_7`, `streak_30`, etc.).

### 6.9 `whatsapp-send`

- **Auth:** internal or admin.
- **Input:** `{ recipient_phone, template_code, variables, related_report_id? }`
- **Action:** verify template exists + approved, call Gupshup API with `Bearer` token from Vault, insert `whatsapp_messages` row with `status='sent'` and `provider_message_id`. On HTTP error → `status='failed'`, schedule fallback email.
- **Rate limit:** 100 / min per institute (Gupshup limit).

### 6.10 `gupshup-callback`

- **Auth:** HMAC-verified webhook (X-Gupshup-Signature) — no JWT.
- **Action:** update `whatsapp_messages.status` based on event (`delivered`, `read`, `failed`).

### 6.11 `parent-report-generate`

- **Auth:** internal cron or admin.
- **Schedule:** weekly Sunday 18:00 IST.
- **Input (cron):** none, iterates all active students.
- **Input (ad-hoc):** `{ student_id, period_start, period_end }`
- **Action:**
  1. Aggregate attendance %, exam scores, offline test scores, upcoming exams, teacher comment.
  2. Render PDF via `pdf-lib` from a hand-laid template.
  3. Upload to `generated-pdfs/{student_id}/{period_end}.pdf`.
  4. Insert `parent_reports` row.
  5. Build short-lived signed URL (24h).
  6. Queue `whatsapp-send` for each parent phone with template `parent_weekly_report` and the signed URL as a variable.

### 6.12 `audit-log-cleanup`

- **Schedule:** quarterly.
- **Action:** anonymizes `audit_log` rows older than 2 years — strips IP, user agent; sets `actor_user_id = null` for deleted users.

### 6.13 `attendance-correct` (Phase 4 CP6)

- **Auth:** teacher (in session's batch) or admin.
- **Input:** `{ attendance_id: uuid, new_status: 'present'|'late'|'absent', reason: string (3..500 chars) }`
- **Action:** reads existing `attendance` row → verifies actor authority → refuses if `new_status` matches current (`status_already_matches`) → updates `attendance.status` + `method='correction'` + `marked_by=actor` → inserts `attendance_corrections` row with `prev_status` / `new_status` / `reason` / `changed_by=actor` → writes `audit_log` `attendance_corrected` with before/after JSON.
- **Audit:** `attendance_corrected`.

### 6.14 `attendance-bulk-mark` (Phase 4 CP6)

- **Auth:** teacher (in session's batch) or admin.
- **Input:** `{ session_id: uuid, status: 'present'|'late'|'absent', target: 'unmarked'|'all' }`
- **Action:** for every student in the session's batch whose `(session_id, student_id)` row does not yet exist (target=`unmarked`) — or all students (target=`all`, admin-only) — inserts an `attendance` row with `method='manual'`, `marked_by=actor`. `ON CONFLICT DO NOTHING` guarantees no overwrites.
- **Audit:** `attendance_bulk_mark` with `{count, target}`.

### 6.15 `attendance-manual-mark` (Phase 4 CP10, per **D-156**)

- **Auth:** teacher (in session's batch).
- **Input:** `{ session_id: uuid, student_id: uuid, status: 'present'|'late'|'absent' }`
- **Action:** INSERT-only. Verifies teacher-batch scope, refuses if `(session_id, student_id)` row already exists (`409 already_marked`), else inserts `attendance` with `method='manual'`, `marked_by=teacher`.
- **Audit:** `attendance_manual_marked`.
- **Why this fn exists** (over the bulk-mark + correct pair): bulk targets >1 student; correct requires an existing row. This is the right primitive for "teacher taps P/L/A on one unmarked roster row".

### 6.16 `attendance-unmark` (Phase 4 §B, per **D-165**)

- **Auth:** teacher (in session's batch).
- **Input:** `{ attendance_id: uuid }`
- **Action:** verifies teacher-batch scope → DELETEs the attendance row → writes `audit_log` `attendance_unmarked` with the deleted state in `before_data` so history isn't lost.
- **Audit:** `attendance_unmarked`.
- **UI trigger:** mobile teacher roster tap-on-active-pill → confirm Alert → invoke (per **D-164**).

### 6.17 `session-create-ad-hoc` (Phase 4 CP6)

- **Auth:** teacher assigned to the target batch.
- **Input:** `{ batch_id: uuid, duration_min: 30|45|60|90, subject_id?: uuid }`
- **Action:** computes `scheduled_start` from the next 15-minute mark, `scheduled_end = start + duration_min`. Verifies teacher-batch via `batch_teachers`. Inserts `sessions` row with `is_ad_hoc=true`, `status='scheduled'`, `created_by=teacher`.
- **Audit:** `session_created_ad_hoc`.

## 7. Realtime Channels

Supabase Realtime (Postgres-backed broadcasting + presence).

| Channel | Pattern | Members | Use |
|---|---|---|---|
| Live class chat | `room:session:{session_id}` | Students in batch + teacher + admin | Broadcast new chat messages; member presence count |
| Raise hand | `room:session:{session_id}:hands` | Students + teacher | Student raises → broadcast; teacher resolves → broadcast |
| Live class state | `room:session:{session_id}:state` | All members | Status changes (`live`, `ended`); pinned announcements |
| Teacher attendance counter | `room:session:{session_id}:roster` | Teacher only | Live count of attendance marks |

Authorization for channel join is enforced via RLS on the underlying `sessions` table (Realtime checks SELECT permission on the row before allowing subscribe).

**Phase 4 CDC channels (applied 2026-05-15):** instead of a custom broadcast channel, the teacher roster screen and student dashboard subscribe to **Postgres Change Data Capture** on `public.attendance` via the `supabase_realtime` publication (migration `20260515221227_realtime_attendance`). Authorization is the same RLS path used for SELECTs, so a teacher only receives events for rows in their batches and a student only receives events for their own attendance. Verified by `pnpm smoke:realtime` 2/2 (service-role subscriber receives every event; teacher-JWT subscriber receives only RLS-allowed rows).

## 8. Storage Buckets

All buckets **private**. Access via signed URLs only.

| Bucket | Purpose | Path pattern | Signed URL TTL |
|---|---|---|---|
| `profile-pictures` | User avatars | `{user_id}/avatar.jpg` | 1 hour |
| `study-materials` | Course PDFs | `{course_id}/{topic_id}/{content_id}.pdf` | 1 hour |
| `exam-images` | Question diagrams | `{question_id}/{filename}` | 1 hour |
| `generated-pdfs` | Parent reports | `{student_id}/{period_end}.pdf` | 24 hours |
| `badge-assets` | Badge SVGs | `{badge_code}.svg` | 24 hours (cacheable) |

Upload pipeline: client requests a presigned upload URL from an edge function (which enforces auth + file type/size validation), then PUTs directly. The edge function records the `file_path` in the relevant table on success.

**Max sizes:** PDFs 50 MB, images 5 MB. Videos are not stored in Supabase — they live on YouTube.

## 9. Scheduled Jobs

Implemented via Supabase Cron (pg_cron extension).

| Job | Cron | Function | Purpose |
|---|---|---|---|
| Streak tick | `0 2 * * *` | `streak-recompute` | Daily 02:00 IST |
| Mastery sweep | `30 2 * * *` | `mastery-recompute` (full) | Catch any missed recomputes |
| Parent reports | `0 18 * * 0` | `parent-report-generate` | Sunday 18:00 IST |
| Audit cleanup | `0 3 1 */3 *` | `audit-log-cleanup` | Quarterly |
| Session materialize | `0 0 * * *` | `public.materialize_sessions(14)` (DB fn — **applied Phase 4 CP7** as `materialize-sessions-nightly`) | Generates next 14 days of sessions from `batch_schedule`. Idempotent on re-run. |
| Backup verify | `0 4 * * *` | external (GH Action) | Confirms daily Supabase backup ran |

## 10. Third-Party Integrations

### YouTube Data API v3
- Single institute Google account with a dedicated YouTube channel.
- OAuth 2.0 with offline access. Refresh token stored in Supabase Vault.
- API quotas: 10,000 units/day default. Each broadcast create ~ 50 units. At ~10 classes/day = 500 units. Safe headroom.
- Broadcasts created `unlisted`. YT chat disabled (replaced with our chat).
- Ingest server endpoint passed back to teacher's app for OBS setup.

### Gupshup WhatsApp Business API
- Single business number, verified.
- Pre-approved templates: `parent_weekly_report`, `parent_attendance_alert`, `parent_exam_result`, `student_credentials_initial`.
- Webhook at `/api/webhooks/gupshup` (admin app) for delivery callbacks.
- Fallback: on `failed` status, queue an email to parent + send admin notification.

### Sentry
- Two projects: `mobile`, `admin`. DSNs stored in respective env files.
- Source maps uploaded on each release via EAS + Vercel build hooks.
- PII scrubbing: full_name and email allowed; phone, parent_phone, dob redacted.

### PostHog
- Self-anchored events: `app_open`, `login`, `attendance_marked`, `quiz_started`, `quiz_submitted`, `exam_started`, `exam_submitted`, `live_class_joined`, `video_watched`.
- Identify via Supabase `auth.users.id`. No PII in event properties.
- Consent gate: students see a consent banner on first launch.

## 11. Auth Flow

```
                       ┌──────────────────────┐
                       │   Admin creates user │
                       │   via web panel      │
                       └──────────┬───────────┘
                                  ▼
                     auth-bootstrap edge fn
                                  │
            ┌─────────────────────┴──────────────────┐
            │                                        │
            ▼                                        ▼
   Supabase Auth row created           Initial password email sent
            │
            ▼
  ┌─────────────────────┐
  │  Student launches   │
  │  mobile app         │
  └─────────┬───────────┘
            ▼
       Login screen ──► Supabase auth.signInWithPassword
            │
            ▼
  must_change_password = true?
            │
         yes│                                    no│
            ▼                                      ▼
  force-password-change screen                Dashboard
            │
            ▼
  updates password, flips flag to false
            │
            ▼
        Dashboard
```

**Session handling:**
- Access JWT (1h), refresh token (30d rolling) stored in `expo-secure-store`.
- App auto-refreshes on focus.
- On forced logout (admin suspends user), the next refresh returns 401 → app clears tokens and shows "Your account has been suspended. Contact admin."

**Password reset:**
- "Forgot password" → Supabase magic link emailed → opens deep link `fynestudy://reset?token=...` → app prompts new password → updates.
- Admin can also "Reset password" from web panel → re-runs `auth-bootstrap`-style flow.

**Rate limits:**
- 5 password attempts per email per 15 minutes (Supabase native).
- 3 magic-link sends per email per 15 minutes.

## 12. MFA (Admin Only)

- TOTP via Supabase MFA.
- On first admin login: forced enrollment with QR code (Google Authenticator / Authy compatible).
- Recovery codes generated once; admin downloads as PDF.
- Subsequent logins: email + password + 6-digit TOTP.

## 13. Server-Time Sync (Exam Integrity)

The exam timer is **always** authoritative on the server.

- Client requests `GET /functions/v1/server-time` on exam start and periodically.
- Client computes offset = `server_now - device_now`.
- Display countdown using `server_now = device_now + offset`.
- Submit-time check is server-side anyway, so a tampered client only hurts itself.

## 14. Watermarking (Live + Recording Playback)

- Edge fn `yt-playback-sign` includes `watermark_text = "{student_name} • ••••{phone_last_4}"` in the signed payload.
- Wrapped player renders a semi-transparent (alpha 0.25) overlay across the bottom 30% of the player surface, position rotated every 60 seconds to prevent crop-based defeat.
- Recording playback uses the same approach — the watermark is rendered client-side, not baked into the YT video.

## 15. Backup & Disaster Recovery

- Supabase daily full Postgres backup (managed). 7-day retention on prod.
- Point-in-Time Recovery (PITR) — to be enabled when MVP goes live.
- Storage buckets backed up daily via a Supabase Edge cron that snapshots to a secondary bucket (or external S3-compatible store, TBD).
- Disaster scenario: full project loss → restore from snapshot + redeploy migrations + edge functions from git → estimated RTO 4 hours, RPO 24 hours.

## 16. Secrets Management

- Supabase Vault holds: YouTube OAuth refresh token, Gupshup API key, Sentry auth token, PostHog server key, parent-report HMAC secret, QR-token HMAC secret, playback-sign HMAC secret.
- Mobile app receives only: Supabase URL, Supabase anon key, Sentry mobile DSN, PostHog client token. All public-safe.
- Admin panel receives the same on the client; server-side actions use server-only env from Vercel.
- `.env*` files never committed.
- HMAC secrets rotated quarterly; old secret kept valid for 24h for in-flight tokens.

## 17. Observability

- **Logs:** Supabase function logs piped to Logflare (built-in). Retained 7 days on free tier.
- **Metrics:** Supabase project dashboard for DB connections, edge function invocations, storage egress.
- **Alerts:** Sentry alert rules on (a) any unhandled error in edge fn, (b) error rate spike >2x baseline, (c) WhatsApp send failure rate >5%.
- **Health checks:** GitHub Actions cron pings `/health` on admin panel and a `health` edge function every 5 minutes.

## 18. Scaling Plan (Beyond MVP)

At 600 students the architecture is comfortably over-provisioned. The first scale bottlenecks (and answers) are:

- **Realtime fanout in big live classes (1000+ viewers):** Supabase Realtime tops out around ~3000 concurrent subscribers per channel. Move chat to a dedicated channel-per-batch and shard if needed; or fall back to a polling endpoint at scale.
- **YouTube API quota:** request quota increase from Google if classes >150/day.
- **Edge function cold start:** under 100 invocations/min there's effectively no cold start. At higher load, pre-warm via cron pings.
- **DB connection pool:** Supabase pgBouncer is fine for <10k req/min. PostgREST handles bursty reads.

Sharding, read replicas, dedicated Postgres, and SFU adoption are all future paths if metrics demand it.
