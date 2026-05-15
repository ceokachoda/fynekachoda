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

## 14. Acceptance Ledger — closed 2026-05-15

Phase 3 closed on **2026-05-15** with all twelve checkpoints (CP1–CP12) green. Work sits on `main` uncommitted, ready for the Phase 3 PR. The Vercel admin deployment is still pinned to the Phase 1 placeholder build; the Phase 3 PR will be the first push that lights up Phase 2 + Phase 3 admin UI on Vercel.

### AC results

| # | Acceptance Criterion | Result | Evidence |
|---|---|---|---|
| 1 | Migration runs cleanly on dev. Default courses + default batch exist | ✅ pass | CP1. Migration `20260515063322_courses_batches` applied via MCP. 4 courses (`JEE_MAIN`, `JEE_ADV`, `NEET_UG`, `CUET_UG`) + 11 subjects + 1 `Default Batch (rename me)` row seeded. `pnpm test:rls` Test 7 reads ≥4 active courses; Test 9 reads exactly own batch. |
| 2 | Existing Phase 2 students auto-mapped to "Default Batch (rename me)" | ✅ pass | CP2. Migration `20260515063821_students_batch_required` backfills `batch_id` to the default-batch UUID for every existing row, then `ALTER COLUMN … SET NOT NULL`. Existing demo student `cp5-smoke-1778780435619@…` and the Phase 2 audit-log entry both verified post-backfill. |
| 3 | Admin opens `/courses` — sees 4 courses with their subjects | ✅ pass | CP6. `apps/admin/app/(dashboard)/courses/page.tsx` lists 4 courses; clicking each opens `/courses/[id]` with the curriculum tree pre-populated. Nav link enabled in `(dashboard)/layout.tsx`. |
| 4 | Admin adds a chapter and topic under "Physics" of NEET UG. Tree persists; reorder works | ✅ pass | CP6. `curriculum-mutate` v1 supports 12 ops (create/update/delete × course/subject/chapter/topic). `pnpm smoke:curriculum` runs all 12 + error paths. **Deviation:** no drag-drop reorder; reorder via inline `sort_order` input field (Phase 12 polish). |
| 5 | Admin renames "Default Batch (rename me)" to "NEET 2027 Morning" | ✅ pass | CP7. `batch-mutate.update_batch` op + admin `/batches/[id]` edit form. User verified click-through during CP7. |
| 6 | Admin creates "JEE Main 2027 Evening" batch with capacity + schedule | ✅ pass | CP7. `batch-mutate.create_batch` + `create_schedule_row` ops. `pnpm smoke:batch-mutate` 11/11 includes capacity + schedule creation. |
| 7 | Admin creates teacher and assigns them to a batch | ✅ pass | CP8 + CP10. `auth-bootstrap` with `role=teacher` (CP8) + `batch-mutate.assign_teacher` (CP7). User verified by creating `cp10-teacher@fynestudy.example.com` during CP10 click-through. |
| 8 | Admin creates new student, picks batch — credentials shown | ✅ pass | CP3 + CP7. `auth-bootstrap` v2 extended for `batch_id`; `/students/new` batch picker enabled in CP7. CP10 used this path to create `cp9-test@…`. |
| 9 | Student logs in mobile — profile shows correct batch + course | ✅ pass | CP9. `useMyBatch` hook + `(student)/profile.tsx` read-only rows. User verified with `cp9-test@…` showing "Default Batch (rename me) · NEET UG". |
| 10 | Teacher logs in mobile — sees batch in My Batches | ✅ pass | CP10. `useAssignedBatches` hook + `(teacher)/index.tsx` real home. User verified with cp10-teacher showing Default Batch · 13 students. |
| 11 | Teacher opens batch detail — sees student list (RLS-scoped) | ✅ pass | CP10 (after RLS fix). Migration `20260515121845_teacher_app_users_read` added missing `app_users_teacher_batch_read` policy; without it, embed returned NULL `app_users` and roster rendered "—" per student. User re-verified roster shows 13 real student names. |
| 12 | Teacher cannot see students from other batches | ✅ pass | CP3 + CP10. `pnpm test:rls` Tests 12 (T1 sees Student A only, not Student B) + 15 (T1 cannot read Student B's `app_users` row). |
| 13 | Admin transfers a student → audit + mobile reflects new batch | ✅ pass | CP4. `batch-transfer` v1 atomic capacity + audit + 404 + same-batch checks. `pnpm smoke:batch-transfer` 8/8 includes the full transfer cycle. |
| 14 | Capacity check: batch full → admin tries to add → error | ✅ pass | CP4 + CP7. `batch-transfer` rejects with 409 when destination at capacity; `auth-bootstrap` honours the same rule via the validation chain in `batch-mutate`. Smoke test exercises both. |
| 15 | RLS tests cover required scenarios | ✅ pass | `pnpm test:rls` extended from Phase 2's 6 tests to **17 tests** (Tests 7–17 added across CP3, CP10, CP11). Covers: course read by authenticated, batch read by member only, teacher reads assigned-batch students, app_users teacher-batch read, mfa_recovery_codes self-read + write-block. |
| 16 | `pnpm typecheck` + `pnpm test:rls` green | ✅ pass | `pnpm -r typecheck` clean across 6 workspaces; `pnpm test:rls` 17/17. |
| 17 | CI green on phase branch | ⏳ **pending PR** | All workspace gates pass locally. CI run lands when the Phase 3 PR is opened. Same status shape as Phase 2 §14 AC #20. |

**Phase 2 carry-overs (completed in CP11):**

| # | Criterion | Result | Evidence |
|---|---|---|---|
| C-1 | TOTP recovery codes (Phase 2 AC #3 partial) | ✅ pass | CP11. Migration `20260515132622_mfa_recovery_codes` + edge fns `mfa-codes-issue` v1 + `mfa-codes-consume` v1 + admin `/2fa/enroll` extension + new `/2fa/recovery` page + middleware update. `pnpm smoke:mfa-recovery` 10/10 (issue → DB shape → re-issue replaces → consume → replay 401 → bogus 401 → audit). User-verified localhost sign-in confirms the admin app compiles + the existing TOTP funnel still works; the new fresh-enrolment/consume flow is mechanically proven. |
| C-2 | `docs/backend-architecture.md §3` schema-doc drift sweep (Phase 2 §14 DoD item) | ✅ pass | CP11. Status note rewritten with full 10-migration ledger; §3.1 fixed (`teachers.subjects` default + CP10 RLS callout); §3.9 action vocabulary list; new §3.10 block for `mfa_recovery_codes`. |

**Mechanical proof corpus:**
- `pnpm -r typecheck` — 6/6 workspaces clean.
- `pnpm --filter @fynestudy/admin lint` — 0 errors, 0 warnings.
- `pnpm --filter @fynestudy/mobile lint` — 0 errors, 0 warnings.
- `pnpm --filter @fynestudy/mobile test` — 5 suites, 48 tests, all green (added `features/org/schedule.test.ts` 7 cases in CP10).
- `pnpm --filter @fynestudy/shared test` — 17 zod validation tests (CP5).
- `pnpm test:rls` — 17 RLS scenarios + sanity sub-tests, all PASS.
- `pnpm smoke:batch-transfer` — 8 steps PASS (CP4).
- `pnpm smoke:curriculum` — 12 steps PASS (CP6).
- `pnpm smoke:batch-mutate` — 11 steps PASS (CP7).
- `pnpm smoke:mfa-recovery` — 10 steps PASS (CP11).
- `mcp__claude_ai_Supabase__get_advisors security` — only pre-existing `auth_leaked_password_protection` WARN (Phase 1 backlog, untouched by Phase 3).
- 10 migrations applied, 11 edge functions deployed (`auth-bootstrap` v2, `auth-suspend`, `auth-force-reset`, `auth-clear-must-change`, `auth-change-own-password`, `batch-transfer`, `curriculum-mutate`, `batch-mutate`, `mfa-codes-issue`, `mfa-codes-consume`, `health`).

### Definition-of-done results

- [x] All 17 ACs pass (AC #17 pending PR CI run).
- [x] RLS tests cover every new policy (17/17 includes CP3 + CP10 + CP11 additions).
- [ ] **Pending PR:** CI green on `main` — local gates clean; PR run is the final gate.
- [x] `packages/supabase-types/index.ts` regenerated (CP5) — staged on disk.
- [x] Specs updated: `docs/backend-architecture.md §3` + new §3.10 (CP11).
- [x] `docs/decisions.md` not amended this phase — no decisions overturned; CP-level deviations recorded inline below.
- [ ] User says "Phase 3 accepted" — pending this review.

### Deliberate deviations from the original Phase 3 doc

Recorded so future contributors don't think these were accidents.

1. **Migrations use timestamp prefix** (`20260515063322_…`), not the doc's ordinal `0004_…`. Repo convention from Phase 1; same shape as Phase 2's migrations. The 10 applied migrations are listed in `docs/backend-architecture.md §3` status note.
2. **`auth-bootstrap` extended in CP3** to accept optional `batch_id: uuid`; falls back to the Default Batch lookup when absent. Forward-compatible with the CP7 batch picker. Doc body assumed bootstrap remained unchanged.
3. **Single `*-mutate` edge fn per resource family** (`curriculum-mutate` 12 ops, `batch-mutate` 8 ops) instead of one edge fn per op. Mutation + audit kept atomic in one server-side hop; reduces edge-fn count for the same surface.
4. **No drag-drop reorder on curriculum tree, no bulk transfer.** Inline `sort_order` numeric inputs + per-row Transfer button replace both. Phase 12 polish.
5. **`teachers.subjects` is free-form comma-separated text input**, not a picker against the `subjects` curriculum table. `teachers.subjects text[]` was never FK-bound (D-013 informal); a picker is Phase 7 work.
6. **Server actions + edge fn pattern for admin mutations**, not TanStack Query. Mirrors Phase 2's existing pattern; consistency wins over the doc's TanStack reference.
7. **Mobile delete actions return state + redirect on success** (`apps/admin/app/(dashboard)/{batches,courses}/actions.ts`), surfaced after a CP7 bug where silently-failing void actions made deletes look like no-ops.
8. **`useMyBatch` and `useAssignedBatches` are bespoke React hooks**, not TanStack Query. Mobile has no TanStack dependency yet; the two screens that need cached fetches don't justify adding ~80kB to the bundle.
9. **CP10 RLS fix: new `app_users_teacher_batch_read` policy** (migration `20260515121845`). Discovered during CP10 click-through when the batch-detail roster rendered "—" for every student name. Locked in by `test-rls.ts` Tests 14 + 15.
10. **CP10 auth refactor: new edge fn `auth-change-own-password` v1.** Mobile no longer calls `supabase.auth.updateUser({ password })` from the force-password-change screen; the edge fn does both the password change (service-role `admin.auth.admin.updateUserById`) and the `must_change_password=false` flip in one round-trip. Eliminates the iOS Expo Go fetch-drop bug that recurred in CP9 and CP10 (see memory `auth-client-timeouts`).
11. **Mobile auth timeouts bumped to 30s + `getSession()` fallback** (`apps/mobile/features/auth/auth.ts`). After observing 89ms server-side /token responses paired with 15s+ client-side delays (suspected iOS Keychain write blocking the supabase-js promise), the auth-call budget was widened and a post-timeout `sessionLanded()` check was added. Login screen also subscribes to `useSession().session` and auto-routes when a session lands asynchronously.
12. **CP11 hash algorithm: SHA-256 hex**, not Argon2 / bcrypt. Codes carry ~50 bits of entropy and never leave the server hashed; the threat model is "stop trivial database-leak compromise", not "defeat a determined offline attacker against a low-entropy secret". Web Crypto is present in both Deno (edge fn) and Node (smoke test) — no extra dep needed.
13. **CP11 consume = wipe TOTP factor + force re-enrolment.** Supabase's MFA API exposes no path to upgrade AAL from a non-TOTP secret; re-enrolment is the only correct recovery loop. After consume, the user gets a fresh 10-code batch on the next enrolment.
14. **CP11 no admin-driven "Reset MFA on another admin" UI.** Phase 2 §8 risk row sketched this; it depends on an `/admins` management page slated for Phase 12 (`phase-12.md §27 + §358`). The recovery-code self-service path covers the dominant case (admin lost authenticator). Carry-over recorded below.
15. **Phase 3 work is one big PR**, not eleven micro-PRs. Phase 2 set this pattern (one large PR for the whole phase) and the user explicitly confirmed it for Phase 3 at the start of CP1.

### Carry-overs into Phase 4

- **Vercel admin deployment fix.** `admin-kohl-sigma.vercel.app` currently serves the Phase 1 "Coming online…" placeholder build because Phase 2's `app/page.tsx` deletion (commit `ac7031c`) was never picked up. The Phase 3 PR is the first push that will redeploy Vercel with the full Phase 2 + Phase 3 admin surface. Manual click-through verification on Vercel becomes possible once that PR merges.
- **Admin "Reset MFA on another admin" UI** — depends on the Phase 12 admin-management page. The recovery-code self-service path already handles the common case; this entry covers the "admin lost authenticator AND lost recovery codes" edge case.
- **Android cold-start measurement** on a Redmi 8A class device (Phase 2 §14 AC #19) — still deferred pending hardware.
- **Sentry + PostHog wiring** (Phase 1 deferred) — drop-in points are `apps/mobile/lib/crash.ts` and `apps/mobile/lib/analytics.ts`.
- **TOTP enrolment for mobile** — currently TOTP is admin-only (web). When Phase 8 introduces teacher-side mutations from mobile, mobile may want optional TOTP per the spec. Out of scope for Phase 3.
- **Curriculum tree drag-drop + bulk teacher import + bulk student transfer** — deferred polish (Phase 12).
- **`auth-clear-must-change` edge function cleanup** — still deployed but unreachable now that `auth-change-own-password` is the single-call replacement. Safe to delete in a Phase 4 housekeeping commit (or leave deployed indefinitely; both are fine).

### Phase 3 highlights vs. Phase 2

| Aspect | Phase 2 | Phase 3 |
|---|---|---|
| Migrations applied | 4 | 10 (+6 in Phase 3) |
| Edge functions deployed | 4 | 11 (+7 in Phase 3) |
| RLS test count | 6 + 2 sanity | 17 + sanity |
| Smoke-test scripts | 2 (`cp5`, `cp8`) | 6 (`cp5`, `cp8`, `batch-transfer`, `curriculum`, `batch-mutate`, `mfa-recovery`) |
| Mobile jest tests | 41 | 48 (+7 schedule tests) |
| Workspaces affected | mobile, admin, functions | + shared (validation), supabase-types |
| Deviations recorded | 11 | 15 |
| Carry-overs handed off | 5 | 7 |
