# Phase 4 — Sessions & Attendance

> Rotating 30-second HMAC-signed QR (student displays, teacher scans) + manual roster + ad-hoc sessions + corrections + history view. Server-enforced replay protection. End-to-end attendance flow on real devices.

---

## 1. Goal

Make attendance the first feature that proves the platform is real: a student displays a QR, a teacher scans it, both see immediate, audited state changes.

## 2. Prerequisites

- [ ] Phase 3 accepted.
- [ ] At least one batch with assigned teacher + at least one student in Supabase.
- [ ] A second physical device for testing (teacher device for scanning student's QR).
- [ ] Camera permission flow tested on both iOS and Android dev builds.

## 3. Scope

### In
- DB: `sessions`, `attendance`, `attendance_corrections`, `activity_days`.
- Cron: nightly `materialize-sessions` (DB function or edge fn) that creates `sessions` rows from `batch_schedule` for the next 14 days.
- Edge functions: `attendance-qr-sign`, `attendance-qr-verify`, `attendance-bulk-mark`, `attendance-correct`, `session-create-ad-hoc`, `materialize-sessions`.
- HMAC: secret in Supabase Vault; rotation helper.
- Mobile student: `(student)/attendance.tsx` rebuilt — rotating QR (30s) + per-session selection + attendance history (today, week, month).
- Mobile teacher: `(teacher)/scan.tsx` (camera scanner), `(teacher)/roster/[sessionId].tsx` (manual), `(teacher)/classes.tsx` (today's sessions list + "Create Ad-hoc Session").
- Realtime: `room:session:{id}:roster` channel — teacher sees attendance count tick.
- Admin: `/attendance` (corrections + per-batch reports).
- Mobile dashboard "Next Card" + "Today's Schedule" reflect real session data (partial — full dashboard is Phase 8).
- Rate limits: QR sign 1/5s/student; verify 2/s/teacher.

### Out
- Geofencing (rejected D-035).
- Half-day attendance (rejected D-036).
- Bulk CSV upload of attendance (Phase 11 admin completion).
- Attendance-driven push notifications (deferred to phase 3+).

## 4. Specs in play

- `docs/spec/attendance.md` — primary.
- `docs/spec/security.md §5` (HMAC + replay).
- `docs/spec/teacher-panel.md §7` (Scan QR).
- `docs/decisions.md` D-030 to D-038.

## 5. Backend work

### 5.1 Migration: sessions + attendance + activity_days (Checkpoint 1)

`supabase/migrations/0007_sessions_attendance.sql`:

```sql
create table public.sessions (
  id              uuid primary key default gen_random_uuid(),
  batch_id        uuid not null references public.batches(id) on delete cascade,
  subject_id      uuid references public.subjects(id),
  scheduled_start timestamptz not null,
  scheduled_end   timestamptz not null check (scheduled_end > scheduled_start),
  is_ad_hoc       boolean not null default false,
  is_live_class   boolean not null default false,
  yt_broadcast_id text,           -- nullable; populated in Phase 9
  yt_video_id     text,
  status          text not null default 'scheduled' check (status in ('scheduled','live','ended','cancelled')),
  started_at      timestamptz,
  ended_at        timestamptz,
  created_by      uuid references public.app_users(id),
  created_at      timestamptz not null default now()
);

create index sessions_batch_time_idx on public.sessions (batch_id, scheduled_start);

create table public.attendance (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.sessions(id) on delete cascade,
  student_id  uuid not null references public.students(user_id) on delete cascade,
  status      text not null check (status in ('present','late','absent')),
  method      text not null check (method in ('qr','manual','correction')),
  marked_at   timestamptz not null default now(),
  marked_by   uuid references public.app_users(id),
  qr_token_jti text,
  notes       text,
  unique (session_id, student_id)
);

create index attendance_student_marked_idx on public.attendance (student_id, marked_at desc);

create table public.attendance_corrections (
  id            uuid primary key default gen_random_uuid(),
  attendance_id uuid not null references public.attendance(id) on delete cascade,
  prev_status   text not null,
  new_status    text not null,
  reason        text not null,
  changed_by    uuid not null references public.app_users(id),
  changed_at    timestamptz not null default now()
);

create table public.activity_days (
  student_id uuid not null references public.students(user_id) on delete cascade,
  day        date not null,
  primary key (student_id, day)
);
```

### 5.2 Migration: attendance RLS (Checkpoint 2)

`supabase/migrations/0008_attendance_rls.sql`:

```sql
alter table public.sessions enable row level security;
alter table public.attendance enable row level security;
alter table public.attendance_corrections enable row level security;
alter table public.activity_days enable row level security;

-- Sessions: student of batch + teacher of batch + admin
create policy sessions_student on public.sessions for select to authenticated
  using (batch_id = (select batch_id from public.students where user_id = public.current_app_user_id()));

create policy sessions_teacher on public.sessions for select to authenticated
  using (
    public.has_role('teacher')
    and batch_id in (select batch_id from public.batch_teachers where teacher_id = public.current_app_user_id())
  );

create policy sessions_admin on public.sessions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Attendance: student reads own; teacher reads batch's; admin all.
create policy attendance_student_self on public.attendance for select to authenticated
  using (student_id = public.current_app_user_id());

create policy attendance_teacher on public.attendance for select to authenticated
  using (
    public.has_role('teacher')
    and session_id in (
      select s.id from public.sessions s
      join public.batch_teachers bt on bt.batch_id = s.batch_id
      where bt.teacher_id = public.current_app_user_id()
    )
  );

create policy attendance_admin on public.attendance for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- No insert/update policies for authenticated — writes via edge fns (service-role).

-- attendance_corrections + activity_days: admin all, student/teacher read own scope
create policy ac_admin on public.attendance_corrections for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy ad_student_self on public.activity_days for select to authenticated
  using (student_id = public.current_app_user_id());

create policy ad_admin on public.activity_days for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
```

### 5.3 HMAC secret + edge utilities (Checkpoint 3)

Generate a 32-byte HMAC secret. Store in Supabase Vault as `QR_TOKEN_SECRET_V1` (and `QR_TOKEN_SECRET_V2` for rotation grace).

`apps/functions/_shared/hmac.ts`:

```ts
async function signQrPayload(payload: { sid: string; uid: string; exp: number; jti: string }) {
  const secret = await getSecret("QR_TOKEN_SECRET_V1");
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const data = enc.encode(`${payload.sid}|${payload.uid}|${payload.exp}|${payload.jti}`);
  const sig = await crypto.subtle.sign("HMAC", key, data);
  return base64url(sig);
}

async function verifyQrPayload(payload, sig): Promise<boolean> {
  // Try V1 then V2 (grace window)
}
```

### 5.4 Edge fn: attendance-qr-sign (Checkpoint 4)

`apps/functions/attendance-qr-sign/index.ts`:

Input: `{ session_id }`

Steps:
1. Verify JWT; resolve `current_app_user_id` → `student_id`.
2. Confirm student belongs to the session's batch (via SELECT with RLS).
3. Check scan window: `scheduled_start - 15min <= now <= scheduled_end + 15min`. Otherwise 400 "Window closed."
4. Check no `attendance` row already exists for `(session_id, student_id)` — if so, 409 "Already marked."
5. Generate payload: `{ v: 1, sid, uid: student_id, exp: now + 30, jti: short_uuid }`.
6. Compute HMAC; return base64url(JSON) + raw fields.
7. Rate limit: 1 / 5s per student per session (Postgres-backed token bucket).

Returns: `{ payload: string, exp: number }`.

### 5.5 Edge fn: attendance-qr-verify (Checkpoint 5)

`apps/functions/attendance-qr-verify/index.ts`:

Input: `{ qr_payload, session_id }` (teacher's selected session)

Steps:
1. Verify JWT; resolve teacher; check `teacher_id` is in `batch_teachers` for the session's batch.
2. Decode payload; verify HMAC; verify `exp > now`. Else 400.
3. Verify `payload.sid === session_id`. Else 400 "QR belongs to different class."
4. Verify student in session's batch. Else 403.
5. Try INSERT into `attendance` `(session_id, student_id, …)` with status computed:
   - `now <= scheduled_start + 10min` → `present`
   - `now <= scheduled_start + 30min` → `late`
   - else → 400 "Scan window closed for new entries."
6. On unique constraint violation → 409 "Already marked."
7. UPSERT `activity_days(student_id, today_IST)`.
8. Broadcast on `room:session:{sid}:roster` Realtime → live tick.
9. Audit log.
10. Return `{ status, student_name }`.

Rate limit: 2 / s per teacher.

**STOP. Checkpoint 5.** Verify by running both edge fns with `curl` + a hand-crafted payload.

### 5.6 Edge fn: attendance-correct & bulk-mark & session-create-ad-hoc (Checkpoint 6)

`attendance-correct`: teacher/admin only; updates an existing `attendance.status`; inserts `attendance_corrections`; audit.

`attendance-bulk-mark`: teacher only; input `{ session_id, mark_remaining: 'present'|'absent' }`; inserts rows for every student in batch with no existing attendance row.

`session-create-ad-hoc`: teacher only; input `{ batch_id, subject_id?, start, end }`; creates a session with `is_ad_hoc = true`, returns its id.

### 5.7 Cron: materialize-sessions (Checkpoint 7)

Runs nightly at 00:30 IST. For each active batch:
1. For each `batch_schedule` row, compute next 14 days of occurrences.
2. INSERT into `sessions` ON CONFLICT DO NOTHING.

Idempotent — running multiple times is safe.

Implemented as a DB function `materialize_sessions(days int)` callable from a pg_cron job + an admin "Re-materialize now" button on the batches page.

`supabase/migrations/0009_materialize_sessions.sql`:

```sql
create or replace function public.materialize_sessions(days int default 14)
returns int language plpgsql security definer set search_path = public as $$
declare
  inserted int := 0;
begin
  -- Pseudocode; implementation walks batch_schedule × dates
  with cal as (
    select generate_series(current_date, current_date + (days - 1), '1 day')::date as d
  ),
  occurrences as (
    select bs.batch_id, bs.subject_id,
           (c.d + bs.start_time)::timestamptz at time zone 'Asia/Kolkata' as scheduled_start,
           (c.d + bs.end_time)::timestamptz   at time zone 'Asia/Kolkata' as scheduled_end
    from public.batch_schedule bs
    join cal c on extract(dow from c.d)::int = bs.weekday
    where bs.is_active
  )
  insert into public.sessions (batch_id, subject_id, scheduled_start, scheduled_end)
  select o.batch_id, o.subject_id, o.scheduled_start, o.scheduled_end
  from occurrences o
  on conflict do nothing;
  get diagnostics inserted = row_count;
  return inserted;
end;
$$;

-- pg_cron schedule (requires pg_cron extension enabled in Supabase dashboard)
select cron.schedule('materialize-sessions-nightly', '30 18 * * *', $$select public.materialize_sessions(14);$$);
-- 18:30 UTC = 00:00 IST
```

### 5.8 Realtime channel auth (Checkpoint 8)

In Supabase Studio (or via SQL), confirm Realtime has `room:session:*` channels open. RLS on `sessions` table provides the authorization signal — Realtime only allows subscribe to channels whose underlying row the user can SELECT.

For the `:roster` sub-channel, teacher writes via Supabase Broadcast API (or relies on `attendance` INSERT events being streamed via Postgres CDC — simpler).

## 6. Frontend work — summary

### Mobile student: rebuild attendance screen (Checkpoint 9)

`apps/mobile/app/(student)/attendance.tsx`:

UI layout per `spec/attendance.md §8`:
- Today's sessions list with status badges.
- For the *next relevant session* in the scan window: show rotating QR.
- Session switcher if multiple eligible.
- History card with this week / this month %.
- "View detailed history" → modal with calendar heatmap.

QR component (`components/attendance/QrDisplay.tsx`):
- Receives session_id.
- Calls `attendance-qr-sign` every 25 s.
- Renders QR via `react-native-qrcode-svg`.
- Mini countdown text "Refreshes in 18s".
- Pull-to-refresh forces re-sign.

### Mobile teacher: scanner + roster (Checkpoint 10)

`apps/mobile/app/(teacher)/scan.tsx`:
- `expo-camera` `CameraView` with `barCodeScannerSettings.barCodeTypes = ['qr']`.
- Top picker: session selector (default = nearest live/upcoming session in teacher's batches).
- On scan → call `attendance-qr-verify` → toast + haptic.
- Sequential scan mode (continues scanning until "Done" tap).
- Switch-to-Roster button.

`apps/mobile/app/(teacher)/roster/[sessionId].tsx`:
- Loads roster from `students` join `attendance` (per spec §5).
- P / L / A pills per student.
- "All Present" / "All Absent" bulk.
- Long-press student → correction modal with reason field.

`apps/mobile/app/(teacher)/classes.tsx`:
- Segmented Today / Upcoming / Past.
- "+" FAB → "New Ad-hoc Class" sheet.
- Each row links to scan / roster / detail.

### Mobile dashboard partial wiring (Checkpoint 11)

`apps/mobile/app/(student)/index.tsx`:
- Replace Phase 2 placeholder content with:
  - Greeting + streak placeholder ("Streak coming in Phase 8" — actually just shows 0 for now).
  - Today's Schedule from `sessions` join `attendance`.
  - Stats strip: Attendance % computed client-side from `attendance` queries (mastery + rank still placeholders).

(Full dashboard is Phase 8; this gives users something real to see now.)

### Admin: attendance page (Checkpoint 12)

`apps/admin/app/(dashboard)/attendance/page.tsx`:
- Filters: date range, batch.
- Table: rows = students, columns = sessions in range, cells = status.
- Click cell → correction modal.
- Export CSV.

## 7. Files changed (summary)

### Mobile — added
- `app/(student)/attendance.tsx` (rebuilt from old check-in)
- `app/(teacher)/scan.tsx`
- `app/(teacher)/roster/[sessionId].tsx`
- `app/(teacher)/classes.tsx`
- `components/attendance/QrDisplay.tsx`, `AttendanceHistory.tsx`, `AttendanceRing.tsx`
- `components/teacher/ScannerOverlay.tsx`, `RosterRow.tsx`, `AdhocSheet.tsx`
- `features/attendance/useQrToken.ts`, `useScanVerify.ts`, `useRoster.ts`

### Mobile — edited
- `app/(student)/index.tsx` (today's schedule + attendance %)
- `app/(student)/_layout.tsx` (tab icons; rename "Check-in" → "Attendance")

### Edge fns added
- `attendance-qr-sign`, `attendance-qr-verify`, `attendance-correct`, `attendance-bulk-mark`, `session-create-ad-hoc`

### DB
- 3 migrations (sessions/attendance/RLS, materialize fn, secrets reference)

### Admin
- `/attendance` page

### Shared
- `packages/shared/src/constants/attendance.ts` — `WINDOW_BEFORE_MIN = 15`, `LATE_AFTER_MIN = 10`, etc.

## 8. Integration & cross-cutting

- Audit: `attendance_marked`, `attendance_corrected`, `attendance_bulk_mark`, `session_created_ad_hoc`, `session_cancelled`.
- Telemetry: `attendance_qr_shown`, `attendance_qr_verified` (with status), `attendance_manual_marked`, `attendance_corrected`.
- Permissions: ensure `expo-camera` permission is requested on first scan attempt; show denial-recovery screen with deep link to OS settings.

## 9. Risks & gotchas

| Risk | Mitigation |
|---|---|
| HMAC clock skew between Supabase servers and devices | Verification uses server time; client clock irrelevant. Document. |
| Race: two devices scanning same student's QR simultaneously | Unique constraint absolute; second gets 409. Tested. |
| Teacher accidentally selects wrong session, marks students from another batch | `attendance-qr-verify` checks payload.sid == session_id AND student-in-batch. Mismatched batch → 403. |
| Camera permission denied → blocked teacher flow | `(teacher)/scan.tsx` falls back to roster + shows settings deep link. |
| Materialize-sessions doesn't run (cron disabled by Supabase free tier upgrade) | Admin "Re-materialize now" button + nightly health check pings the function. |
| QR rotation feels jarring during scan | 30s window is generous; teacher sees instant haptic on each scan; success is fast. |
| Long-press correction modal eats touch events | Use react-native-gesture-handler long-press with 600ms delay. |
| Realtime channel ghosts | Standard unsub on unmount + presence cleanup. |

## 10. Acceptance criteria

1. Migrations run cleanly.
2. `pg_cron` job appears in `cron.job` table.
3. Manually call `select public.materialize_sessions(14)` — N rows inserted.
4. Student opens attendance screen during a session window → QR appears.
5. QR rotates every ≤30 seconds.
6. Teacher opens scanner → scans student's QR → toast "✔ {name} — Present" within 1 second.
7. Student's attendance screen refreshes → status flips to "Present".
8. Teacher scans the same QR again immediately → "Already marked" toast.
9. Teacher scans a QR after waiting 30s+ → "Expired" toast.
10. Teacher selects a different session → scans the same QR → "QR belongs to different class".
11. Manual roster works: teacher taps P / L / A; persists; reflects on student side.
12. "All Present" bulk fills unmarked students; doesn't override existing rows.
13. Late student (11+ min after start) → status = `late`; visible in history.
14. Very late (31+ min) → scan blocked; manual mark still allowed.
15. Ad-hoc session: teacher creates → appears in roster scan list; attendance flow works.
16. Correction: teacher long-presses → changes status with reason → `attendance_corrections` row created + audit log entry.
17. Admin `/attendance` page shows the corrected status with edit history.
18. Camera permission denied → friendly fallback screen with "Open Settings" deep link.
19. Cross-batch isolation: a teacher of batch A cannot mark a student from batch B (RLS test).
20. Cold app start budget still under 3s.
21. CI green; new RLS tests green.

## 11. Test plan

### Unit
- HMAC sign/verify round-trip; tampered signature rejected.
- Status determination by clock (mock now).
- Scan window check.

### Integration
- `attendance-qr-verify`: happy path; expired; wrong session; cross-batch; replay; rate limit.
- `attendance-correct`: admin can; teacher (in batch) can; teacher (out of batch) cannot.
- `session-create-ad-hoc`: only assigned teacher.
- `materialize_sessions`: idempotent; doesn't duplicate.

### RLS
- Student of batch A cannot read attendance of batch B.
- Teacher of batch A cannot read attendance of batch B.

### Manual QA (two-device, real hardware)
- Pixel 6 + Redmi 8A pair: teacher scans student. Repeat 10 times. No errors.
- iPhone 12 + Redmi 8A: same.
- Power-off student's phone mid-session, teacher manual-marks → student returns → sees correct status.

### Edge cases
- Two simultaneous scans from two teacher devices (race).
- Network drop on student between sign requests → token expires → UI shows refresh hint.

## 12. Rollback plan

If Phase 4 breaks:
1. Revert migrations 0007–0009.
2. `sessions` and `attendance` tables drop (loses test data — acceptable in dev).
3. Mobile attendance screen reverts to a placeholder.
4. Edge fns can stay deployed but unused.

## 13. Definition of done

- [ ] All 21 AC pass.
- [ ] Two-device manual test recorded as a 30-second video.
- [ ] RLS tests cover all new policies.
- [ ] HMAC secret in Supabase Vault, not env.
- [ ] CI green.
- [ ] `docs/perf-baselines/phase-4.md` records scan p95 latency on reference device.
- [ ] User says "Phase 4 accepted".

## 14. Hand-off to Phase 5

- `sessions` and `attendance` infrastructure done.
- Activity_days populated on every attendance mark.
- Phase 5 builds the library on top of `topics` (already there from Phase 3) and adds wrapped YT player + PDF reader + watermark. No further changes to attendance code.
