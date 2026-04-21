# Phase 07 — Teacher / Admin Panel & Ops

## Goal

Ship a **web** admin/teacher panel (Next.js) that lets the non-technical owner and teachers run the entire institute day-to-day without an engineer in the loop.

## Why a separate web app (not RN)

Admin workflows are desk-and-keyboard workflows: tables, bulk selection, multi-column sort, CSV export, rich uploads, side-by-side windows. React Native cannot match that UX, and making it work well on tablet/desktop would waste more effort than Next.js costs. A Next.js panel also lets us lean on shadcn/ui + Tailwind for professional polish quickly, use server components for fast data fetching, and share the same Supabase backend with zero duplication.

The teacher surface has two halves:
1. **Mobile teacher app** (same RN binary with role gating) — for live class hosting, scanner mode, quick uploads from phone.
2. **Teacher web panel** (Next.js, subset of admin panel) — for heavy uploads, clip editing, attendance reports, class scheduling.

## Scope

### In-scope
- Full admin panel covering every module listed below.
- Teacher panel as a filtered subset of the admin panel (role-gated).
- CSV import/export for students + attendance.
- Dashboards with day-to-day KPIs.
- Audit log viewer.
- Announcement composer with scheduling.

### Out-of-scope
- Multi-tenant (multiple institutes).
- Granular permissions beyond the 3 roles (no custom role builder).
- White-labeling per teacher.

## User roles impacted
- Admin: full access.
- Teacher: restricted view (their batches/classes/students only).
- Student: unaffected.

## Admin panel module list

| Module | Sub-routes |
|---|---|
| Overview / Dashboard | `/admin` — today's classes, active members, revenue this month, upload queue, red alerts |
| Users | `/admin/students`, `/admin/teachers`, `/admin/users/[id]` |
| Batches & Courses | `/admin/batches`, `/admin/courses`, `/admin/enrollments` |
| Classes | `/admin/classes`, `/admin/classes/new`, `/admin/classes/[id]` |
| Attendance | `/admin/attendance` (per class + per student), `/admin/attendance/manual-mark` |
| Content | `/admin/content` (all types), `/admin/content/upload`, `/admin/recordings`, `/admin/clips` |
| Plans & Memberships | `/admin/plans`, `/admin/memberships` |
| Payments | `/admin/payments`, reconciliation view |
| Announcements | `/admin/announcements` |
| Notifications | `/admin/notifications/logs`, `/admin/notifications/templates` |
| Reports | `/admin/reports/attendance`, `/admin/reports/revenue`, `/admin/reports/engagement` |
| Audit | `/admin/audit` |
| Settings | `/admin/settings/branding`, `/admin/settings/providers` (keys), `/admin/settings/users` |

## Screens & workflows (detail)

### Students
- Table: name, phone, batch, membership status, attendance %, last seen, actions.
- Filters: batch, membership status, date joined.
- Actions: view profile, reset OTP, reassign batch, extend membership, suspend/unsuspend.
- Add student: form + CSV bulk import.
- Profile page: tabs for Info / Attendance / Payments / Devices.

### Teachers
- Similar table; add teacher creates auth user with email+password and role `teacher`.
- Assign batches/subjects.

### Classes
- Weekly calendar view + list view.
- Create class: batch, subject, teacher, date/time, duration, type (live/recorded/hybrid), recurring option.
- Per-class drawer: attendance roster, recording status, participant list, timings, manual mark attendance.

### Attendance
- Per-class view: list with checkmarks, manual mark toggle, "Mark All Present" (with confirmation).
- Per-student view: calendar heatmap, monthly %, list.
- Export CSV.

### Content
- Unified table of materials, recordings, clips with type filters.
- Upload wizard: drag-drop, metadata, visibility, preview, publish.
- Moderation queue: items pending review (teacher uploads) → admin approves/rejects.

### Plans & Memberships
- Plan CRUD.
- Memberships table with filters (active, expired, expiring in 7 days).
- Bulk extend, bulk send reminder.

### Payments
- Transactions table with Razorpay reconciliation status.
- Detail drawer shows raw Razorpay event history.
- "Retry webhook" button.

### Announcements
- WYSIWYG composer (tiptap).
- Target: all / batch / course.
- Schedule: now / at specific time.
- Push preview.

### Reports
- Attendance: line chart per batch, exportable.
- Revenue: monthly bar chart + collection rate.
- Engagement: DAU/WAU, top-watched recordings, most-opened materials.

### Audit log
- Every admin write action logs a row in `audit_log`.
- Viewer with filters by actor, table, date.

## Frontend tasks (admin panel)

### Stack
- Next.js 15 App Router + TypeScript.
- Tailwind + shadcn/ui for all primitives.
- `@tanstack/react-table` for data grids.
- `@tanstack/react-query` for client fetching; server components for initial loads.
- `zod` + `react-hook-form` for forms.
- `recharts` for charts.
- `@supabase/ssr` for cookie auth.

### Cross-cutting
- Middleware guards `/admin/**` with role check.
- Sidebar navigation with role-aware items (teachers see fewer items).
- Breadcrumbs + page title per route.
- Global search (press `/`): students, classes, content.
- Toast system (sonner).
- Keyboard shortcuts for power users (j/k table nav, n=new).

### Performance
- Lists paginate via keyset pagination (`id > last_id`) to scale beyond 10k rows.
- Heavy writes go through server actions or Edge Functions; never expose service-role key to the browser.

## Teacher panel (subset)
- Dashboard: my classes today, my uploads pending review, my attendance tasks.
- Classes: only mine.
- Upload wizard: can upload materials; admin approves before publish (or auto-publish if admin setting allows).
- Clip editor for own recordings.
- Attendance view for own classes.
- No access to payments, plans, other teachers, or admin settings.

## Backend tasks

- Most reads/writes go via Supabase client with RLS. Admin-only operations use service-role via Next.js server actions.
- New table: `announcements` (id, title, body_html, target_batch_id, target_course_id, target_audience, scheduled_at, published_at, created_by, image_url).
- `audit_log` triggers on admin-only tables.
- Edge Function `send-announcement` — when published, enqueues notification rows.

## Third-party integrations
- Optional: Resend or AWS SES for transactional email (password reset, invoices).

## Recommended libraries
| Purpose | Package |
|---|---|
| Tables | `@tanstack/react-table` |
| Forms | `react-hook-form`, `zod` |
| WYSIWYG | `@tiptap/react` |
| Charts | `recharts` |
| Date | `date-fns`, `date-fns-tz` |
| CSV | `papaparse` |
| Upload | `react-dropzone` |
| Toasts | `sonner` |
| Icons | `lucide-react` |

## Edge cases
- Admin deletes a student with payments → soft-delete; hard delete blocked.
- Bulk CSV import with partial failures → report shows per-row errors; successful rows committed.
- Role-gate bypass attempts → middleware + RLS + server actions all check.
- Teacher tries to access another teacher's class → RLS returns empty; UI shows "Not found".

## Risks
| Risk | Mitigation |
|---|---|
| Admin panel becomes the bottleneck for demo if not ready | MVP subset (users + classes + content + attendance only) must be ready by end of P4 to seed demo data. The rest can land after. |
| Non-technical owner breaks data | Every destructive action requires typed confirmation ("type DELETE to confirm"). |

## Dependencies on earlier phases
- Phase 1 (auth, schema).
- Phases 2–6 for feature parity — but Phase 7 work can start right after Phase 1 and grow alongside.

## Acceptance criteria
- [ ] Owner can, without engineering help: add a student, create a batch, enroll students, schedule a class, upload a PDF, view today's attendance, extend a membership.
- [ ] Teacher can: see their classes, upload a material, mark attendance manually, view recording, create a clip.
- [ ] RLS proven: teacher API cannot read another teacher's students.
- [ ] CSV import handles 500 students in <60s.
- [ ] Audit log is populated for every admin write.
- [ ] Lighthouse score ≥90 on admin dashboard.

## Definition of done
- Every acceptance criterion.
- Admin user guide (Markdown) covering each top-level workflow with screenshots.
- All destructive actions have typed confirmations.
- Deployed to `admin.fynestudy.live` (or internal domain) with SSL.

## Suggested folder / module breakdown

```
apps/admin/
├── app/
│   ├── (auth)/
│   │   └── sign-in/page.tsx
│   ├── (panel)/
│   │   ├── layout.tsx                  # sidebar + role guard
│   │   ├── page.tsx                    # /admin dashboard
│   │   ├── students/
│   │   ├── teachers/
│   │   ├── batches/
│   │   ├── courses/
│   │   ├── classes/
│   │   ├── attendance/
│   │   ├── content/
│   │   ├── recordings/
│   │   ├── clips/
│   │   ├── plans/
│   │   ├── memberships/
│   │   ├── payments/
│   │   ├── announcements/
│   │   ├── notifications/
│   │   ├── reports/
│   │   ├── audit/
│   │   └── settings/
│   └── api/
│       └── (if needed)
├── components/
│   ├── ui/                             # shadcn
│   ├── tables/
│   ├── forms/
│   ├── charts/
│   └── layout/
├── lib/
│   ├── supabase/server.ts
│   ├── supabase/client.ts
│   ├── rbac.ts
│   └── csv.ts
└── middleware.ts
```

## Suggested order of implementation

1. Layout, sidebar, auth middleware, role guard, base shadcn components.
2. Users (students + teachers) — this unlocks seeding data for other phases.
3. Batches + courses + enrollments.
4. Classes (schedule, edit, per-class drawer).
5. Content upload wizard (plugs into Phase 5).
6. Attendance views (per-class + per-student) with manual mark.
7. Plans + Memberships (plugs into Phase 6).
8. Payments table with reconcile controls.
9. Announcements composer + `send-announcement` function.
10. Audit log viewer.
11. Reports (charts).
12. Teacher-panel filtering (reuse admin components with scope).
13. Deploy to Vercel, wire SSL, DNS.
14. Write admin user guide.
