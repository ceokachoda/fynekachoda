# Phase 11 — Parents' WhatsApp Report

> Auto-generated weekly PDF report per student, delivered to up to 2 parent WhatsApp numbers via Gupshup. On-demand by teacher/admin. Email fallback. Teacher notes per student per period.

---

## 1. Goal

The last student-facing feature. Parents who never touch the app get a weekly snapshot of their child's progress. Reliable delivery via WhatsApp; email if WhatsApp fails.

## 2. Prerequisites (external — start early)

- [ ] Phase 10 accepted.
- [ ] **Gupshup WhatsApp Business Account** created and verified. Display name approved. Phone number associated.
- [ ] **Templates submitted and approved** by Meta via Gupshup:
  - `parent_weekly_report` (4 vars: student_name, period_label, attendance_pct, pdf_url)
  - `student_credentials_initial` (3 vars: student_name, email, password) — used by Phase 2's auth-bootstrap when teacher invites (we wire it now)
- [ ] Gupshup API key + app name obtained.
- [ ] Webhook secret obtained from Gupshup partner portal.
- [ ] (Optional but recommended) Resend account for email fallback.
- [ ] Institute logo prepared (PNG, ≤1 MB) — used in the PDF header.

If Gupshup templates aren't approved yet (typical wait: 1–3 business days), **submit them now and continue Phase 11 backend work**; only the live test is blocked until approval.

## 3. Scope

### In
- DB: `parent_reports`, `whatsapp_templates`, `whatsapp_messages`, `teacher_notes`, plus `institute_config` singleton (for logo, contact, branding).
- Edge functions: `parent-report-generate`, `whatsapp-send`, `gupshup-callback`, `whatsapp-retry`, `email-fallback-send`.
- PDF renderer using `pdf-lib` in Deno.
- Storage: `generated-pdfs` bucket.
- Gupshup webhook handler in admin app (`/api/webhooks/gupshup`).
- Cron: weekly Sun 18:00 IST; hourly retry sweep.
- Admin: `/whatsapp` (templates + send log), `/reports` (per-student ad-hoc trigger).
- Mobile teacher: per-student note editor + "Send Report Now" button.

### Out
- Daily reports.
- SMS as primary channel.
- Two-way WhatsApp conversations.
- Parent app login.

## 4. Specs in play

- `docs/spec/parents-report.md` — primary.
- `docs/spec/admin-panel.md §16` (WhatsApp section).
- `docs/decisions.md` D-080 to D-085.

## 5. Backend work

### 5.1 Migration: reports + WA + notes + config (Checkpoint 1)

`supabase/migrations/0024_parent_reports.sql`:

```sql
create table public.parent_reports (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null references public.students(user_id) on delete cascade,
  period_start date not null,
  period_end   date not null,
  pdf_path     text not null,
  generated_at timestamptz not null default now(),
  unique (student_id, period_start, period_end)
);

create table public.whatsapp_templates (
  code           text primary key,
  name           text not null,
  body           text not null,
  variable_keys  text[] not null,
  status         text not null check (status in ('pending','approved','rejected')),
  approved_at    timestamptz,
  updated_at     timestamptz not null default now()
);

create table public.whatsapp_messages (
  id                  uuid primary key default gen_random_uuid(),
  recipient_phone     text not null,
  template_code       text not null references public.whatsapp_templates(code),
  payload             jsonb not null,
  related_report_id   uuid references public.parent_reports(id),
  status              text not null default 'queued' check (status in ('queued','sent','delivered','read','failed')),
  provider_message_id text,
  error               text,
  queued_at           timestamptz not null default now(),
  sent_at             timestamptz,
  delivered_at        timestamptz,
  retried_at          timestamptz,
  retry_count         int not null default 0
);

create index wa_status_queued_idx on public.whatsapp_messages (status, queued_at);

create table public.teacher_notes (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references public.students(user_id) on delete cascade,
  teacher_id  uuid not null references public.teachers(user_id) on delete restrict,
  period_start date,
  period_end  date,
  body_md     text not null check (char_length(body_md) <= 1000),
  created_at  timestamptz not null default now()
);

create table public.institute_config (
  id            uuid primary key default '00000000-0000-0000-0000-000000000001'::uuid,
  name          text not null default 'FyneStudy',
  logo_path     text,
  primary_color text not null default '#1a73e8',
  contact_url   text,
  contact_email text,
  timezone      text not null default 'Asia/Kolkata',
  updated_at    timestamptz not null default now()
);

insert into public.institute_config (id, name) values ('00000000-0000-0000-0000-000000000001', 'FyneStudy') on conflict do nothing;
```

### 5.2 Migration: RLS (Checkpoint 2)

```sql
alter table public.parent_reports enable row level security;
alter table public.whatsapp_templates enable row level security;
alter table public.whatsapp_messages enable row level security;
alter table public.teacher_notes enable row level security;
alter table public.institute_config enable row level security;

create policy pr_student_self on public.parent_reports for select to authenticated using (student_id = public.current_app_user_id());
create policy pr_teacher_batch on public.parent_reports for select to authenticated using (
  public.has_role('teacher')
  and student_id in (select s.user_id from public.students s where s.batch_id in (select batch_id from public.batch_teachers where teacher_id = public.current_app_user_id()))
);
create policy pr_admin on public.parent_reports for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy wat_admin on public.whatsapp_templates for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy wam_admin on public.whatsapp_messages for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy tn_self_read on public.teacher_notes for select to authenticated using (
  student_id = public.current_app_user_id()
  or teacher_id = public.current_app_user_id()
  or (public.has_role('teacher') and student_id in (select s.user_id from public.students s where s.batch_id in (select batch_id from public.batch_teachers where teacher_id = public.current_app_user_id())))
  or public.is_admin()
);
create policy tn_teacher_write on public.teacher_notes for all to authenticated
  using (public.has_role('teacher') and teacher_id = public.current_app_user_id())
  with check (public.has_role('teacher') and teacher_id = public.current_app_user_id());
create policy tn_admin on public.teacher_notes for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy ic_read on public.institute_config for select to authenticated using (true);
create policy ic_admin on public.institute_config for all to authenticated using (public.is_admin()) with check (public.is_admin());
```

### 5.3 Storage: generated-pdfs bucket (Checkpoint 3)

```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('generated-pdfs', 'generated-pdfs', false, 5242880, array['application/pdf']);
-- Signed URLs only; admin server-role uploads.
```

### 5.4 Edge fn: parent-report-generate (Checkpoint 4)

`apps/functions/parent-report-generate/index.ts`:

Inputs (cron mode): none — iterate all active students with ≥1 parent phone.
Inputs (ad-hoc): `{ student_id, period_start?, period_end? }`.

Steps:
1. Determine period: `period_end = nearest Sunday <= now` (cron) or per input; `period_start = period_end - 7 days`.
2. For each target student:
   a. Skip if no parent phone(s).
   b. Aggregate via a single SQL call:
      - Attendance counts (week + cumulative).
      - In-app exam attempts in window with released results.
      - Offline scores in window.
      - Top weak mastery topics.
      - Upcoming exams (next 14 days).
      - Latest teacher_note in window.
      - Streak + last week's rank from `leaderboard_snapshots`.
   c. Render PDF using `_shared/pdf.ts` (pdf-lib).
   d. Upload to `generated-pdfs/{student_id}/{period_end}.pdf`.
   e. INSERT `parent_reports` row.
   f. For each parent phone, build signed URL (24h), queue WhatsApp send.
3. Return summary `{ students_processed, reports_generated, messages_queued }`.

Concurrency: batches of 25 students at a time; 4 concurrent PDF renders max.

### 5.5 PDF renderer (Checkpoint 5)

`apps/functions/_shared/pdf.ts`:

Lay out the report per `spec/parents-report.md §4` using `pdf-lib`:
- Header: logo (loaded from `badge-assets/logo.png` or `institute_config.logo_path`) + institute name + "Weekly Report".
- Student info block.
- Attendance section with mini bar.
- Test performance (in-app + offline).
- Mastery (top weak).
- Upcoming.
- Teacher's note (optional).
- Streak + rank footer.
- Generated date + contact info from `institute_config`.

Fonts: bundle Inter Regular + Inter Bold as base64 in `_shared/fonts.ts`. Embed in PDF for portability.

### 5.6 Edge fn: whatsapp-send (Checkpoint 6)

`apps/functions/whatsapp-send/index.ts`:

Input: `{ recipient_phone, template_code, variables: Record<string,string>, related_report_id? }`.

Steps:
1. Validate template_code exists in `whatsapp_templates` AND `status='approved'`. Else 400.
2. Validate variable keys match `variable_keys`. Else 400.
3. Call Gupshup API (`https://api.gupshup.io/sm/api/v1/template/msg`) with `Authorization: Bearer <GUPSHUP_API_KEY>`, body containing template + variables + phone.
4. Parse Gupshup response → `provider_message_id`.
5. INSERT `whatsapp_messages` row with `status='sent'` (or `status='failed'` on HTTP error).
6. If failed, queue email fallback via `email-fallback-send` (best-effort).
7. Audit.
8. Return `{ message_id, status, provider_message_id }`.

Rate limit: 100/min per institute.

### 5.7 Edge fn: gupshup-callback (Checkpoint 7)

`apps/functions/gupshup-callback/index.ts`:

Triggered by Gupshup webhook (`POST /functions/v1/gupshup-callback`).

Steps:
1. Verify `X-Gupshup-Signature` HMAC (secret in Vault).
2. Parse callback body (delivery events: `enqueued`, `sent`, `delivered`, `read`, `failed`).
3. Look up `whatsapp_messages` by `provider_message_id`.
4. UPDATE `status` and timestamps.
5. If `failed`, schedule retry (status → `queued`, retry_count++).

Also exposed via Vercel admin app at `/api/webhooks/gupshup` if Gupshup prefers that endpoint shape — either works; use whichever Gupshup likes.

### 5.8 Edge fn: whatsapp-retry (Checkpoint 8)

Cron: every hour.

Steps:
1. SELECT messages WHERE `status='failed' AND retry_count < 2 AND queued_at > now() - interval '24 hours'`.
2. For each: increment retry_count, set `retried_at = now()`, re-invoke `whatsapp-send` with same payload.
3. After retry_count == 2: trigger `email-fallback-send` (uses parent email if captured) + admin notification.

### 5.9 Edge fn: email-fallback-send (Checkpoint 9)

`apps/functions/email-fallback-send/index.ts`:

Best-effort. Uses Resend (or Supabase's built-in email). Body includes the PDF download link.

If no parent email captured, insert a row in `admin_notifications` (small new table or just write to `audit_log` with `action='wa_failed_no_email'`).

### 5.10 Cron schedules (Checkpoint 10)

```sql
select cron.schedule('parent-report-weekly', '30 12 * * 0', $$select net.http_post('/functions/v1/parent-report-generate', ...)$$);
-- 12:30 UTC Sunday = 18:00 IST Sunday

select cron.schedule('whatsapp-retry-hourly', '0 * * * *', $$select net.http_post('/functions/v1/whatsapp-retry', ...)$$);
```

### 5.11 Wire Phase 2 welcome credentials to WhatsApp (Checkpoint 11)

`auth-bootstrap` from Phase 2 currently emails credentials. Now also send a WhatsApp message via `student_credentials_initial` template if a phone is captured.

This is a small backfill — keeps onboarding consistent: parents AND students get a WhatsApp.

## 6. Frontend work

### 6.1 Admin: WhatsApp section (Checkpoint 12)

`apps/admin/app/(dashboard)/whatsapp/page.tsx`:

Tabs:
- **Send Log**: DataTable of `whatsapp_messages` with status badges, filter by phone/template/status/date.
- **Templates**: list of registered templates with approval status. Submit new template (writes to Gupshup partner API).
- **Provider Settings** (owner only): masked API key, webhook URL, "Test connection" button.

`apps/admin/app/api/webhooks/gupshup/route.ts`:
- Verifies signature.
- Forwards to `gupshup-callback` edge fn OR processes inline.

### 6.2 Admin: per-student report trigger (Checkpoint 13)

`apps/admin/app/(dashboard)/students/[id]/page.tsx`:
- Adds "Generate Parent Report" button (top right).
- Modal: pick period (default this-week) → confirm.
- Calls `parent-report-generate` for this student.
- Shows result: PDF preview link + queued WhatsApp messages list.

### 6.3 Admin: reports page (Checkpoint 14)

`apps/admin/app/(dashboard)/reports/page.tsx`:
- Generate reports for a date range + student selection.
- Bulk download as ZIP (admin only).
- Institute-wide attendance + exam reports (downloadable PDFs).

### 6.4 Mobile teacher: notes + on-demand send (Checkpoint 15)

`apps/mobile/app/(teacher)/batch/[id].tsx?student=...`:
- Adds "Teacher Note" editor (Markdown, max 1000 chars). Saves to `teacher_notes` for current period.
- "Send Parent Report Now" button → calls `parent-report-generate` for this student.

### 6.5 Mobile student: report archive (Checkpoint 16)

`apps/mobile/app/(student)/profile.tsx?tab=reports`:
- Lists past parent reports.
- Tap → opens PDF in `react-native-pdf` (same in-app reader).
- Watermark applied to student-side PDF view.

## 7. Files changed (summary)

### Mobile — added
- `app/(teacher)/batch/[id].tsx` — extended with notes + send button (was Phase 8 placeholder).
- `app/(student)/profile.tsx` — Reports tab.
- `components/teacher/TeacherNoteEditor.tsx`, `SendReportButton.tsx`
- `features/reports/useParentReports.ts`, `useSendReport.ts`, `useTeacherNotes.ts`

### Admin — pages added
- `app/(dashboard)/whatsapp/page.tsx`
- `app/(dashboard)/whatsapp/templates/page.tsx`
- `app/(dashboard)/reports/page.tsx`
- `app/api/webhooks/gupshup/route.ts`

### Admin — pages edited
- `app/(dashboard)/students/[id]/page.tsx` — adds "Generate Parent Report" + report history tab.

### Edge fns added
- `parent-report-generate`, `whatsapp-send`, `gupshup-callback`, `whatsapp-retry`, `email-fallback-send`
- `_shared/pdf.ts`, `_shared/gupshup.ts`, `_shared/fonts.ts`

### Edge fns edited
- `auth-bootstrap` — sends WhatsApp credentials too if phone present.

### DB
- 2 migrations (tables + RLS)
- Storage bucket `generated-pdfs`
- Vault: `GUPSHUP_API_KEY`, `GUPSHUP_APP_NAME`, `GUPSHUP_WEBHOOK_SECRET`, `RESEND_API_KEY` (if used)

### Shared
- `packages/shared/src/validation/reportSchemas.ts`

## 8. Integration & cross-cutting

- Audit: `parent_report_generated`, `whatsapp_send`, `whatsapp_failed`, `whatsapp_retried`, `email_fallback_sent`, `teacher_note_saved`, `template_submitted`.
- Telemetry: `parent_report_generated` `{trigger}`, `parent_report_delivered`, `parent_report_failed`.

## 9. Risks & gotchas

| Risk | Mitigation |
|---|---|
| Gupshup template stuck in approval | Submit early. If still pending at Phase 11 end, dev-test with Gupshup sandbox template + plan production cutover via Phase 12. |
| Webhook signature mismatch | Test with Gupshup's sample payload; log signature check failures. |
| 24h signed URL expires before parent opens | Parents typically open within minutes. If they open after 24h, regeneration is automatic on next view request via a small `/r/{token}` shortlink (consider in v2). |
| PDF render fails for one student (bad font, missing data) | Try/catch per student; failed render logged + skipped + admin notified; cron continues. |
| Cost overrun: 600 students × 2 parents/wk = 1200 messages/wk @ ₹0.42 = ~₹2000/month | Stay in budget for MVP; admin can disable auto-send per batch if needed. |
| Parent phone number formatting | Normalize to E.164 (+91XXXXXXXXXX) at admin entry time; reject invalid. |
| Concurrent PDF renders OOM in edge fn | Max 4 concurrent; batches of 25 sequential. |
| Email fallback misconfigured silently | Send a daily admin digest of failed WA + email-fallback status. |

## 10. Acceptance criteria

1. Migrations clean. `institute_config` singleton row exists.
2. Admin uploads institute logo via `/settings` → reflected in test PDF header.
3. Admin sees both `parent_weekly_report` and `student_credentials_initial` templates in `/whatsapp/templates` with status `approved`.
4. Teacher writes a teacher_note for student A. Persists.
5. Teacher clicks "Send Report Now" for student A → admin's send log shows queued → sent → delivered (verified via real WhatsApp on parent's phone).
6. PDF opens on parent's phone via the WhatsApp link, looks correct, watermarked at footer with "FyneStudy" branding.
7. Cron run on Sunday 18:00 IST generates reports for all 600 students; 1200 messages queued; ≥90% delivered within 2 minutes (monitor via send log).
8. Failed message: simulate by sending to an invalid phone → `status='failed'`; retry runs; email fallback triggered if no email present → admin notification.
9. Student sees their past reports in profile → can view in-app reader; watermark on every page.
10. Webhook receives delivery + read events → `whatsapp_messages` status updates.
11. RLS: student cannot see another student's reports; teacher only sees own batch.
12. Audit log captures every generate + send + retry.
13. Teacher note saved by Teacher A is editable only by Teacher A or admin.
14. WhatsApp credentials sent on student creation (Phase 2 wire-up) — verify the message arrives on student's phone.
15. CI green.

## 11. Test plan

### Unit
- E.164 normalization.
- Template variable validator.
- PDF render: snapshot test on golden student data.

### Integration
- `parent-report-generate` happy path with mocked Supabase data.
- `whatsapp-send`: success / failure / rate-limit handling.
- `gupshup-callback`: each event type updates status correctly.
- `whatsapp-retry`: only picks up retry-eligible messages.

### RLS
- Cross-batch isolation for `parent_reports`.
- Teacher notes write-scope enforced.

### Manual QA
- Real Gupshup sandbox + your own phone: full end-to-end.
- Simulate Sunday cron via SQL execution + verify reports + messages.
- View PDF on real phone (small screen) — readable.

## 12. Rollback plan

If Phase 11 breaks:
1. Disable cron jobs (`select cron.unschedule('parent-report-weekly')`).
2. Revert migrations 0024+.
3. Existing features still function.
4. Pause WhatsApp account if abuse risk.

## 13. Definition of done

- [ ] All 15 AC pass.
- [ ] Live WhatsApp delivery to a real number confirmed.
- [ ] Sunday cron successfully ran (or manual trigger simulated).
- [ ] CI green.
- [ ] User says "Phase 11 accepted".

## 14. Hand-off to Phase 12

- All MVP features feature-complete.
- Phase 12 fills the remaining admin pages, hardens, seeds demo data, runs final QA, and deploys to production.
