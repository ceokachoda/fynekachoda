# Spec: Admin Panel (Web)

The admin panel is a Next.js 15 app deployed on Vercel. It is the **only** way to create users, manage the institute, configure WhatsApp templates, and view the audit log. Two role tiers: **Owner Admin** (full control) and **Staff Admin** (operations only).

---

## 1. Goals

- Make the spreadsheet jobs a coaching institute does daily fast and safe.
- Every write action audited.
- TOTP-required login.
- Same Supabase auth as mobile, role-gated.
- Tables built for thousands of rows.
- Bulk import / export where it saves real time.

## 2. Non-Goals (MVP)

- Mobile-friendly admin UI (admins use a desktop).
- Real-time collaborative editing.
- Theming.
- Plugin system.
- Multi-language admin UI.

## 3. Tech

- Next.js 15 (App Router)
- Tailwind CSS + shadcn/ui
- TanStack Table for grids
- React Hook Form + zod
- Supabase JS (browser + server clients)
- Sentry + PostHog
- Recharts for simple charts

Path aliases: `@/*` rooted at `apps/admin/`.

## 4. Auth & Authorization

### 4.1 Login

`/login`:
- Email + password.
- Failure: same lockout rules as mobile (5/15min).
- On success: redirect to `/2fa/verify` (or `/2fa/enroll` if first time).

### 4.2 MFA

- TOTP required for any admin role.
- Enrollment: scan QR with Google Authenticator / Authy, enter 6-digit code, download 10 recovery codes.
- Verify on every login.
- Recovery code use logs an audit entry.

### 4.3 Middleware

`apps/admin/middleware.ts` runs on every request:
1. Reads Supabase SSR cookie.
2. If no session → redirect to `/login`.
3. If session but no admin role → 403 page "Not authorized".
4. If `staff_admin` accessing owner-only path → 403.

### 4.4 Owner vs Staff

| Capability | Owner | Staff |
|---|---|---|
| CRUD students | ✅ | ✅ |
| CRUD teachers | ✅ | ✅ |
| CRUD admins | ✅ | ❌ |
| CRUD batches | ✅ | ✅ |
| CRUD courses + curriculum | ✅ | View only |
| Promote content course-wide | ✅ | ❌ |
| Send WhatsApp templates | ✅ | ✅ |
| Manage WhatsApp templates | ✅ | ❌ |
| View audit log | ✅ | ✅ |
| Edit institute settings | ✅ | ❌ |
| Force-logout users | ✅ | ❌ |
| Permanent-delete (GDPR) | ✅ | ❌ |

## 5. Information Architecture

Sidebar:

```
Overview
Students
Teachers
Admins                    (owner only)
Batches
Courses
Content
Exams
Attendance
Reports
WhatsApp
Audit
Settings                  (owner only)
```

## 6. Overview

`/`:

```
┌──────────────────────────────────────┐
│  Welcome, Kaustab                    │
│  Institute: FyneStudy                │
├──────────────────────────────────────┤
│  [594 active students]               │
│  [22 teachers]   [3 admins]          │
│  [4 active batches]   [2 courses]    │
├──────────────────────────────────────┤
│  This week                           │
│  • 87% institute attendance          │
│  • 18 exams conducted                │
│  • 612 parent reports sent           │
│  • 4 students at risk                │
├──────────────────────────────────────┤
│  Alerts                              │
│  ⚠ Gupshup template pending approval │
│  ⚠ 2 sessions with no attendance     │
├──────────────────────────────────────┤
│  Recent audit                        │
│  • Priya created student X (2m ago)  │
│  • Sharma released exam result (1h)  │
└──────────────────────────────────────┘
```

## 6A. Admin is the Only Path for Identity Changes (D-016)

Per `decisions.md` **D-016**, the admin panel is the **only** way to change a student's or teacher's:
- `full_name`, `email`, `phone`, `dob`, `gender`, `address`
- `parent_phone_1`, `parent_phone_2`
- `batch_id` (student) → which derives `course_id`
- `subjects[]` (teacher)

The full editability matrix is in `spec/authentication.md §10A`. The mobile app's profile screens render these fields **read-only** and direct the user to contact the admin.

When a student requests a change:
1. Admin opens `students/[id]/edit`.
2. Makes the change.
3. Saves — server action wraps the update in `withAudit` so the before/after diff is logged.
4. For sensitive changes (batch transfer, email change), a confirmation modal asks for a **reason** which is also persisted to the audit log.
5. On batch transfer, attendance and quiz/exam history stay attached to the student record (D-019 in spirit).

## 7. Students

`/students`:

DataTable with:
- Columns: avatar, name, batch, course, attendance %, last active, status, actions
- Filters: batch, course, status, search
- Bulk actions: bulk import (CSV), bulk message (within compliance), bulk export
- "+ New Student" button → `/students/new`

`/students/new`:
- Multi-step form (Identity → Contact → Batch → Parent Consent)
- All fields validated via zod
- On submit → POST to `auth-bootstrap` edge fn → success toast with credentials shown to admin
- "Copy credentials to clipboard" button

`/students/[id]`:
- Profile header (avatar, name, email, batch, status, actions: Suspend / Reset Password / Send Report / Delete)
- Tabs:
  - **Profile** — full details, editable in-place
  - **Attendance** — history with corrections
  - **Exams** — in-app + offline scores
  - **Mastery** — per-topic breakdown
  - **Activity** — login times, last seen
  - **Audit** — every action involving this user

### 7.1 Suspend Flow

Modal: reason required, "this will sign the student out of all devices". Confirm → calls `auth-suspend`.

### 7.2 Delete (Permanent)

Owner-only. Two-step confirmation. Triggers cascade delete + anonymizes aggregates. Audit entry with full prior data snapshot.

### 7.3 Bulk Import

CSV upload. Columns: `full_name, email, phone, parent_phone_1, parent_phone_2, dob, gender, batch_name, school, board, current_class`.

Pipeline:
1. Upload to admin (server-side parse).
2. Validate each row (zod). Show preview with errors highlighted.
3. Admin confirms valid rows.
4. Server processes in batches of 25, calling `auth-bootstrap` per row.
5. Final report: created N, failed M, with reasons.

## 8. Teachers

`/teachers`:
- Similar to students.
- Additional: subjects, assigned batches, MFA status.
- "+ New Teacher" creates user, lets owner assign batches + subjects.

## 9. Admins

`/admins` (owner only):
- List of admins with role tier.
- Create new admin: enters email, picks role (owner/staff). Sends welcome email with creds.
- Demote/promote between owner/staff (with confirmation).
- Force-logout button.
- Delete admin (cannot delete self).

## 10. Batches

`/batches`:
- DataTable.
- "+ New Batch" form: name, course, start/end, capacity, teachers (multi-select), schedule rules (weekday × time grid).
- Edit batch: same form.
- Each batch's detail page: students list + bulk transfer.

### 10.1 Student Transfer

Move a student to a different batch:
- Reason required.
- Past attendance + scores stay attached to the student.
- Audit entry records the move.

## 11. Courses & Curriculum

`/courses`:
- List of courses (JEE Main / JEE Advanced / NEET UG / CUET UG by default; admin can add/archive).
- Owner can create/edit/archive courses. Staff can view only.

`/courses/[id]`:
- Subject tree editor: drag-drop chapters under subjects, topics under chapters.
- Each topic shows count of content items + quizzes.

## 12. Content

`/content`:
- All uploaded content across batches.
- Filter by course, batch, kind, teacher, status (published/pending/suggested-promotion).
- Bulk actions: publish/unpublish, course-wide promote (owner only).
- Click a row → preview (PDF reader or video player) + metadata + history.

## 13. Exams

`/exams`:
- All exams across batches.
- Filter by batch, status, date range.
- Detail page: full results, regrade history, release status, audit.
- Owner can override release (e.g., teacher unavailable).

## 14. Attendance

`/attendance`:
- Date range + batch filter.
- Bulk table: rows = students, columns = sessions in range, cells = status.
- Click cell → correction history.
- "Correct attendance" modal for past sessions with reason field.
- Export CSV.

## 15. Reports

`/reports`:
- Institute attendance summary (per batch, per course)
- Exam summary (per exam, per batch)
- Parent reports log (who got what when)
- Generate ad-hoc parent reports for a date range + student set
- Downloadable institute reports (PDF + CSV)

## 16. WhatsApp

`/whatsapp`:

Tabs:
- **Send Log** — all `whatsapp_messages` with status, retry buttons for failed
- **Templates** — list of Gupshup-approved templates; status (approved / pending / rejected)
- **Compose Custom** (owner only) — send a non-template message during a 24h customer-care window (limited use)
- **Provider Settings** (owner only) — Gupshup API key (masked), webhook health

### 16.1 Template Registry

Stored in `whatsapp_templates` table (mirrors Gupshup):

```sql
create table public.whatsapp_templates (
  code        text primary key,
  name        text not null,
  body        text not null,
  variable_keys text[] not null,
  status      text not null check (status in ('pending','approved','rejected')),
  approved_at timestamptz,
  updated_at  timestamptz not null default now()
);
```

Owner can register new templates: submits to Gupshup via API + writes pending row.

## 17. Audit Log

`/audit`:
- Full DataTable on `audit_log`.
- Filters: actor, role, action, entity_table, entity_id, date range.
- Click row → before/after diff side-by-side (JSON pretty-printed).
- Export CSV.

## 18. Settings (Owner only)

`/settings`:
- Institute name, logo, brand colors (writes to a singleton `institute_config` table).
- Timezone (default Asia/Kolkata).
- Term dates (start / end / holidays).
- Default marking schemes.
- Default class duration.
- 2FA enforcement toggles (staff/teacher).
- Streak rules visibility.
- Demo data toggle (seeds/wipes demo data — dev only).

## 19. Audit Coverage

Every server action in admin panel that mutates state:
- Writes an `audit_log` row before/after.
- Includes `actor_user_id`, `actor_role`, `action`, `entity_table`, `entity_id`, `before_data`, `after_data`, `ip_address`, `user_agent`.

Helper: `lib/audit.ts` wraps Supabase mutation calls.

```ts
await withAudit({
  action: 'update',
  entityTable: 'students',
  entityId: id,
}, async () => {
  return await supabase.from('students').update(data).eq('user_id', id);
});
```

## 20. Telemetry

- `admin_login`
- `admin_action` `{ action, entity }`
- `admin_bulk_import` `{ count, errors }`
- `admin_template_submitted`

## 21. Security Considerations

- All admin pages require server-validated session + role check.
- Cookies: `SameSite=Lax`, `Secure`, `HttpOnly`.
- CSRF: server actions use Next.js built-in token verification (POST + headers).
- Service-role Supabase key only used server-side, never in browser.
- All `auth-bootstrap`-style operations performed via edge functions, never via direct service-role client in Next routes (so logic is centralized + tested).
- Webhook endpoint `/api/webhooks/gupshup` verifies `X-Gupshup-Signature` HMAC before processing.
- Owner-only routes double-check role in both middleware and route handler.
- Rate limit: 30 admin write actions / minute / user (server enforced).

## 22. Performance

- DataTables pagination server-side. Default page size 50.
- Heavy aggregates (attendance summary across institute) precomputed by nightly view refresh.
- Student details page lazy-loads tabs.

## 23. Data Model Touchpoints

- `app_users`, `user_roles`, `students`, `teachers`
- `batches`, `batch_teachers`, `batch_schedule`
- `courses`, `subjects`, `chapters`, `topics`
- `content_items`
- `exams`, `exam_attempts`, `offline_test_scores`
- `attendance`, `attendance_corrections`
- `whatsapp_templates`, `whatsapp_messages`, `parent_reports`
- `audit_log`
- `institute_config` (new singleton table)

## 24. UI / Screens

| Screen | Path |
|---|---|
| Login | `apps/admin/app/login/page.tsx` |
| 2FA enroll | `apps/admin/app/2fa/enroll/page.tsx` |
| 2FA verify | `apps/admin/app/2fa/verify/page.tsx` |
| Overview | `apps/admin/app/(dashboard)/page.tsx` |
| Students list | `.../students/page.tsx` |
| Student detail | `.../students/[id]/page.tsx` |
| New student | `.../students/new/page.tsx` |
| Teachers | `.../teachers/page.tsx` |
| Admins (owner) | `.../admins/page.tsx` |
| Batches | `.../batches/page.tsx` |
| Courses | `.../courses/page.tsx` |
| Content | `.../content/page.tsx` |
| Exams | `.../exams/page.tsx` |
| Attendance | `.../attendance/page.tsx` |
| Reports | `.../reports/page.tsx` |
| WhatsApp | `.../whatsapp/page.tsx` |
| Audit | `.../audit/page.tsx` |
| Settings | `.../settings/page.tsx` |

## 25. Open Items

- Demo accounts toggle: implement as a maintenance-mode banner on /settings.
- Branding upload: allow logo + colors; persist in `institute_config`; mobile reads on login.
- Webhook re-delivery from admin UI: nice-to-have, deferred.
