# Phase 3 — Courses, Batches, Curriculum

> The org model. Courses (JEE Main / JEE Adv / NEET UG / CUET UG), their Subject → Chapter → Topic curriculum trees, batches (cohorts with schedules and capacity), and teacher assignments to batches. By end of phase, admin can build the entire institute org structure; mobile profile shows the student's correct batch + course; teacher's mobile profile lists assigned batches.

---

## 1. Goal

Build the structural backbone so every later feature (attendance, library, quizzes, exams, live) can be scoped to the right batch / course / topic.

## 2. Prerequisites

- [ ] Phase 2 accepted.
- [ ] Owner has decided which courses are active at MVP launch (default: all four — JEE Main, JEE Advanced, NEET UG, CUET UG).
- [ ] Owner has the institute's term dates and typical batch schedule (e.g., "NEET 2027 Morning: Mon/Wed/Fri 6–9 PM").

## 3. Scope

### In
- DB tables: `courses`, `subjects`, `chapters`, `topics`, `batches`, `batch_teachers`, `batch_schedule`.
- Backfill: `students.batch_id` made NOT NULL via a "Default Batch" seeded on migration.
- RLS extension: teacher batch-scoped read on `students`, `attendance` (table created Phase 4 — Phase 3 just preps the policy template).
- Seeds: 4 default courses with subject lists (e.g., NEET UG → Physics + Chemistry + Biology).
- Admin pages: `/courses` (list, edit curriculum tree), `/batches` (list, create, assign teachers, schedule).
- Admin: extend `/students/new` to require batch picker (was disabled in Phase 2).
- Admin: extend `/students/[id]` to allow batch transfer (with reason + audit).
- Admin: `/teachers` list + create + assign subjects + assign batches.
- Mobile student profile: shows batch + course (read-only).
- Mobile teacher: lands on teacher dashboard with assigned batches list (still placeholder UI for batch detail — Phase 8 lights it up).

### Out
- Sessions table (Phase 4).
- Attendance (Phase 4).
- Content library (Phase 5).
- Mastery (Phase 8).
- Batch leaderboard (Phase 10).
- Bulk teacher import.

## 4. Specs in play

- `docs/spec/admin-panel.md §10, §11` (batches + courses).
- `docs/spec/teacher-panel.md §6, §13` (teacher dashboard, batch view).
- `docs/spec/authentication.md §10A` (profile editability — affects student profile).
- `docs/backend-architecture.md §3.2` (courses + batches schema).
- `docs/decisions.md` D-010 to D-015 (org model).

## 5. Backend work

### 5.1 Migration: courses + curriculum (Checkpoint 1)

`supabase/migrations/0004_courses_batches.sql`:

```sql
create table public.courses (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
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
  course_id    uuid not null references public.courses(id) on delete restrict,
  name         text not null,
  starts_on    date not null,
  ends_on      date,
  capacity     int not null default 80 check (capacity > 0),
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  unique (name)
);

create table public.batch_teachers (
  batch_id   uuid not null references public.batches(id) on delete cascade,
  teacher_id uuid not null references public.teachers(user_id) on delete cascade,
  primary key (batch_id, teacher_id)
);

create table public.batch_schedule (
  id         uuid primary key default gen_random_uuid(),
  batch_id   uuid not null references public.batches(id) on delete cascade,
  weekday    int not null check (weekday between 0 and 6),
  start_time time not null,
  end_time   time not null check (end_time > start_time),
  subject_id uuid references public.subjects(id),
  is_active  boolean not null default true
);

-- Seed default courses + a placeholder batch so students.batch_id can be NOT NULL.
insert into public.courses (code, name) values
  ('JEE_MAIN',    'JEE Main'),
  ('JEE_ADV',     'JEE Advanced'),
  ('NEET_UG',     'NEET UG'),
  ('CUET_UG',     'CUET UG');

-- Subjects per course (institute can edit later)
insert into public.subjects (course_id, name, sort_order)
select c.id, s.name, s.ord from public.courses c
cross join (values
  ('JEE_MAIN', 'Physics', 1),
  ('JEE_MAIN', 'Chemistry', 2),
  ('JEE_MAIN', 'Mathematics', 3),
  ('JEE_ADV',  'Physics', 1),
  ('JEE_ADV',  'Chemistry', 2),
  ('JEE_ADV',  'Mathematics', 3),
  ('NEET_UG',  'Physics', 1),
  ('NEET_UG',  'Chemistry', 2),
  ('NEET_UG',  'Biology', 3),
  ('CUET_UG',  'English', 1),
  ('CUET_UG',  'General Test', 2)
) as s(course_code, name, ord)
where c.code = s.course_code;

-- A "Default" batch for migration purposes (admin will rename / disable)
insert into public.batches (course_id, name, starts_on, capacity)
select id, 'Default Batch (rename me)', current_date, 80 from public.courses where code = 'NEET_UG'
limit 1;
```

### 5.2 Migration: students.batch_id NOT NULL + FK (Checkpoint 2)

`supabase/migrations/0005_students_batch_required.sql`:

```sql
-- 1. Assign existing students to the default batch
update public.students
set batch_id = (select id from public.batches where name = 'Default Batch (rename me)' limit 1)
where batch_id is null;

-- 2. Add the FK and NOT NULL
alter table public.students
  alter column batch_id set not null,
  add constraint students_batch_id_fkey
    foreign key (batch_id) references public.batches(id) on delete restrict;

-- 3. Index for fast batch queries
create index students_batch_id_idx on public.students (batch_id);
```

### 5.3 Migration: extended RLS (Checkpoint 3)

`supabase/migrations/0006_batch_rls.sql`:

```sql
-- Teacher can read students in their assigned batches
create policy students_teacher_batch_read on public.students for select to authenticated
  using (
    public.has_role('teacher')
    and batch_id in (
      select bt.batch_id from public.batch_teachers bt
      where bt.teacher_id = public.current_app_user_id()
    )
  );

-- Courses + curriculum: all authenticated can read (no PII; needed for library navigation in Phase 5)
alter table public.courses enable row level security;
alter table public.subjects enable row level security;
alter table public.chapters enable row level security;
alter table public.topics enable row level security;

create policy courses_read on public.courses for select to authenticated using (is_active = true);
create policy subjects_read on public.subjects for select to authenticated using (true);
create policy chapters_read on public.chapters for select to authenticated using (true);
create policy topics_read on public.topics for select to authenticated using (true);

-- Write only via admin
create policy courses_admin_write on public.courses for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy subjects_admin_write on public.subjects for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy chapters_admin_write on public.chapters for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy topics_admin_write on public.topics for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Batches: students read their own batch; teachers read assigned batches; admin all
alter table public.batches enable row level security;

create policy batches_student_self on public.batches for select to authenticated
  using (
    id = (select batch_id from public.students where user_id = public.current_app_user_id())
  );

create policy batches_teacher_assigned on public.batches for select to authenticated
  using (
    public.has_role('teacher')
    and id in (select batch_id from public.batch_teachers where teacher_id = public.current_app_user_id())
  );

create policy batches_admin on public.batches for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- batch_teachers: teacher reads own rows, admin all
alter table public.batch_teachers enable row level security;
create policy bt_self on public.batch_teachers for select to authenticated
  using (teacher_id = public.current_app_user_id());
create policy bt_admin on public.batch_teachers for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- batch_schedule mirrors batches
alter table public.batch_schedule enable row level security;
create policy bs_student on public.batch_schedule for select to authenticated
  using (batch_id = (select batch_id from public.students where user_id = public.current_app_user_id()));
create policy bs_teacher on public.batch_schedule for select to authenticated
  using (public.has_role('teacher') and batch_id in (select batch_id from public.batch_teachers where teacher_id = public.current_app_user_id()));
create policy bs_admin on public.batch_schedule for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
```

**STOP. Checkpoint 3.** Verify all RLS policies in Supabase dashboard; run `pnpm test:rls` (extended with new tests below).

### 5.4 Edge fn: batch-transfer (Checkpoint 4)

`apps/functions/batch-transfer/index.ts`:

Input: `{ student_id, to_batch_id, reason }`.

Steps:
1. Verify admin caller.
2. Validate student + batch exist.
3. Capacity check: target batch's current student count + 1 ≤ batch.capacity.
4. Read `before` row for audit.
5. Update `students.batch_id`.
6. Audit with reason in `after_data`.
7. Return updated student.

### 5.5 Regenerate Supabase types (Checkpoint 5)

```bash
supabase gen types typescript --linked > packages/supabase-types/index.ts
```

Commit the file. CI step added to verify file is up-to-date.

### 5.6 Admin: courses page (Checkpoint 6)

`apps/admin/app/(dashboard)/courses/page.tsx`:
- Lists courses with `is_active` toggle.
- "+ New Course" form: code, name, description.

`apps/admin/app/(dashboard)/courses/[id]/page.tsx`:
- Tabs: Overview / Curriculum.
- Curriculum tab: tree editor.
  - Subjects column → add subject → opens row.
  - Each subject expands to its chapters → add chapter.
  - Each chapter expands to topics → add topic.
  - Drag handles for reordering (`sort_order`).
  - Inline rename.
  - Delete with cascade warning.

Uses TanStack Query mutations wrapped in `withAudit`.

### 5.7 Admin: batches page (Checkpoint 7)

`apps/admin/app/(dashboard)/batches/page.tsx`:
- DataTable: name, course, students count, teachers count, schedule summary, status.
- "+ New Batch" → modal form.

`apps/admin/app/(dashboard)/batches/[id]/page.tsx`:
- Header: name, course, dates, capacity, "Active/Inactive" toggle.
- Sections:
  - **Teachers**: list + "+ Assign teacher" (multi-select from existing teachers).
  - **Schedule**: weekday × time grid editor.
  - **Students**: list, "Transfer to another batch" (per row), bulk "Transfer selected".

### 5.8 Admin: teachers page (Checkpoint 8)

`apps/admin/app/(dashboard)/teachers/page.tsx`:
- DataTable like students.
- "+ New Teacher" → same `auth-bootstrap` edge fn with `role='teacher'`.
- Fields: full_name, email, phone, subjects[], bio.

`apps/admin/app/(dashboard)/teachers/[id]/page.tsx`:
- Profile + Assigned Batches list + "Assign to Batch" button.

### 5.9 Mobile: student profile shows batch + course (Checkpoint 9)

`apps/mobile/app/(student)/profile.tsx`:
- Query: `students` join `batches` join `courses` for the current user.
- Renders:
  ```
  Batch:  NEET 2027 Morning           🔒
  Course: NEET UG                      🔒
  ```
- "Contact admin to change" CTA below.

(All other identity fields already read-only per Phase 2.)

### 5.10 Mobile: teacher home shows assigned batches (Checkpoint 10)

`apps/mobile/app/(teacher)/index.tsx` (replaces Phase 2 placeholder):
- Header greeting.
- Section: "My Batches" — list of assigned batches with student count + next scheduled session.
- Quick actions placeholder (Scan, New Exam, Upload — disabled with "Coming in Phase X" tooltip).

`apps/mobile/app/(teacher)/batch/[id].tsx`:
- Placeholder for now: shows batch name, course, student count, list of students (read-only — uses RLS-scoped query).

## 6. Frontend work — summary

### Mobile — files edited
- `apps/mobile/app/(student)/profile.tsx` — adds batch/course read-only rows.
- `apps/mobile/app/(teacher)/index.tsx` — real teacher home (replaces Phase 2 stub).
- `apps/mobile/app/(teacher)/batch/[id].tsx` — basic batch overview.

### Mobile — files added
- `apps/mobile/features/org/useMyBatch.ts` — student's batch + course query.
- `apps/mobile/features/org/useAssignedBatches.ts` — teacher's batches.

### Admin — pages added
- `apps/admin/app/(dashboard)/courses/page.tsx`
- `apps/admin/app/(dashboard)/courses/[id]/page.tsx`
- `apps/admin/app/(dashboard)/batches/page.tsx`
- `apps/admin/app/(dashboard)/batches/[id]/page.tsx`
- `apps/admin/app/(dashboard)/teachers/page.tsx`
- `apps/admin/app/(dashboard)/teachers/[id]/page.tsx`

### Admin — pages edited
- `apps/admin/app/(dashboard)/students/new/page.tsx` — enable batch picker.
- `apps/admin/app/(dashboard)/students/[id]/page.tsx` — add "Transfer batch" action.

### Edge functions
- `apps/functions/batch-transfer/index.ts`

### Shared packages
- `packages/shared/src/validation/courseSchemas.ts`
- `packages/shared/src/validation/batchSchemas.ts`
- `packages/supabase-types/index.ts` (regenerated)

## 7. Integration & cross-cutting

- Audit log entries: `create_course`, `update_course`, `delete_course`, `create_subject`, `create_chapter`, `create_topic` (and updates/deletes), `create_batch`, `update_batch`, `transfer_student`, `assign_teacher_to_batch`.
- Telemetry: `admin_curriculum_edited`, `admin_batch_transfer`.

## 8. Risks & gotchas

| Risk | Mitigation |
|---|---|
| Default Batch hack leaves "Default Batch (rename me)" visible | Admin onboarding script reminds owner to rename or deactivate; check listed in Phase 12 demo prep. |
| Cascade delete on course wipes all subjects/chapters/topics — and any content keyed off them later | Course delete UI requires "Type the course name to confirm" + admin-only + audit; cascade is intentional. |
| Capacity vs. transfer race condition | Transfer edge fn uses `SELECT count(*) ... FOR UPDATE` or relies on a check constraint via a deferred trigger. Simple approach: re-check capacity in the edge fn inside a transaction. |
| Teacher unassigned from a batch mid-session | We don't strip past data; teacher loses future access; covered by RLS naturally. |
| Curriculum tree editor performance on large trees | Virtualize at chapter level if a course has >50 chapters; not expected in MVP. |

## 9. Acceptance criteria

1. Migration runs cleanly on dev. Default courses + default batch exist.
2. Existing Phase 2 students (if any) auto-mapped to "Default Batch (rename me)".
3. Admin opens `/courses` — sees 4 courses with their subjects.
4. Admin adds a chapter and topic under "Physics" of NEET UG. Tree persists; reorder works.
5. Admin renames "Default Batch (rename me)" to "NEET 2027 Morning".
6. Admin creates a new batch "JEE Main 2027 Evening" with capacity 50, schedule Mon/Wed/Fri 18:00–21:00.
7. Admin creates a teacher and assigns them to "NEET 2027 Morning".
8. Admin creates a new student, picks "NEET 2027 Morning" batch — credentials shown.
9. Student logs in mobile — profile shows "NEET 2027 Morning" + "NEET UG".
10. Teacher logs in mobile — sees "NEET 2027 Morning" in My Batches list with student count.
11. Teacher opens batch detail — sees student list (only their batch's students).
12. Teacher cannot see students from "JEE Main 2027 Evening" (test by creating a student there and checking the teacher cannot see them).
13. Admin transfers a student from "NEET" to "JEE" → audit log entry with reason → student's profile in mobile now shows the new batch.
14. Batch with capacity 1 + 1 student already in → admin tries to add another → error "batch full".
15. RLS tests cover: course read by all authenticated, batch read by member only, teacher can read assigned batch's students.
16. `pnpm typecheck` + `pnpm test:rls` green.
17. CI green.

## 10. Test plan

### Unit tests
- `packages/shared/src/validation/courseSchemas.test.ts`
- `packages/shared/src/validation/batchSchemas.test.ts`

### Integration tests
- `apps/functions/batch-transfer/test.ts` — happy path + capacity check + non-admin caller.

### RLS tests
- Student in batch A cannot read students in batch B.
- Teacher of batch A cannot read students in batch B.
- Admin reads all.
- Anonymous reads return empty for `students`, `batches`.
- Course list is readable by any authenticated user.

### Manual QA
- Build curriculum tree on iPad + desktop browsers.
- Two-teacher batch: both teachers see same students.
- Reorder drag-drop on curriculum tree (mobile-responsive editor not in scope; desktop only).

### Cross-platform
- Mobile: profile renders correctly on Android + iOS; batch text doesn't overflow.

## 11. Rollback plan

If Phase 3 breaks:
1. Revert migrations 0004–0006.
2. `students.batch_id` becomes nullable again; data preserved.
3. Mobile profile screen falls back to "(not assigned)" text.
4. Admin nav still works; failing pages return 500 with clear error.

## 12. Definition of done

- [ ] All 17 AC pass.
- [ ] RLS tests cover every new policy.
- [ ] CI green.
- [ ] `packages/supabase-types/index.ts` regenerated and committed.
- [ ] Specs and `decisions.md` updated if any drift.
- [ ] User says "Phase 3 accepted".

## 13. Hand-off to Phase 4

Phase 4 builds on:
- Students belong to a batch (NOT NULL).
- Batch schedule exists → can materialize sessions.
- Teacher knows which batches they teach → can scan attendance.
- Phase 4 adds `sessions` and `attendance` tables; rebuilds `(student)/attendance.tsx` with rotating QR + history; adds `(teacher)/scan.tsx` and `roster/[id].tsx`.
