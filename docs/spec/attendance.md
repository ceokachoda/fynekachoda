# Spec: Attendance

Two paths to mark a student present: **teacher scans the student's rotating QR**, or **teacher taps the student in a roster**. Both end with the same `attendance` row.

---

## 1. Goals

- One scan per student per session, server-enforced (no replay).
- QR is **dynamic** — token rotates every 30 seconds — so a screenshot is useless.
- Manual mark as a fallback when QR fails (dead phone, lost QR, late student).
- Late and on-time distinction.
- Teacher-side bulk actions ("all present" / "all absent").
- Ad-hoc sessions for makeup classes.
- Attendance history visible to students; corrections audited.

## 2. Non-Goals (MVP)

- Geofencing — explicitly out of scope (friction + demo fragility).
- Face recognition.
- NFC / Bluetooth proximity.
- Self-marking by student (always teacher-mediated).

## 3. Attendance Status

| Status | Meaning |
|---|---|
| `present` | Scanned/marked within `scheduled_start + 10 min` |
| `late` | Scanned/marked between `scheduled_start + 10 min` and `scheduled_start + 30 min` |
| `absent` | No attendance row by `scheduled_end + 15 min` OR explicit absent mark |

`half_day` not supported in MVP.

## 4. QR Mechanics

### 4.1 Token format

The student app polls `attendance-qr-sign` every 25 seconds (gives a 5s overlap). The function returns:

```json
{
  "v": 1,
  "sid": "<session_uuid>",
  "uid": "<student_uuid>",
  "exp": 1715693400,
  "jti": "<short_uuid>",
  "sig": "<hmac_sha256_hex>"
}
```

The HMAC is over the first five fields with the QR-token secret from Vault.

Encoded as a compact base64url string → rendered as a QR code on the student's screen.

Token lifetime: **30 seconds**. Window: only signed when (a) student belongs to session's batch AND (b) `now ∈ [scheduled_start - 15min, scheduled_end + 15min]`.

### 4.2 Student-side polling

```ts
useEffect(() => {
  const fetchToken = () => callFn('attendance-qr-sign', { session_id });
  fetchToken();
  const id = setInterval(fetchToken, 25_000);
  return () => clearInterval(id);
}, [session_id]);
```

App caches the latest token; if `fetch` fails, retains the previous one until `exp - 2s` then shows a "Refresh" tap target.

### 4.3 Teacher-side scanning

`(teacher)/scan.tsx`:
- Opens camera with `expo-camera` (`BarcodeType.qr`).
- Lock to landscape if user prefers.
- On successful decode → calls `attendance-qr-verify` with `{ payload, session_id: <current> }`.
- On success → success haptic + toast "✔ {student_name} — Present". Continues scanning.
- On error → soft red border + toast with reason ("Already marked", "Expired", "Wrong session").

Multi-scan flow: teacher selects which session they're scanning into (defaults to the next scheduled or currently-live session in their assigned batches). Then scans students rapidly.

### 4.4 Verification logic (edge fn)

```
attendance-qr-verify
  caller = teacher
  payload = decoded QR
  session_id = teacher's selected session

  1. Verify HMAC. If invalid → 401.
  2. Check exp > now. If expired → 400 "Expired QR. Ask student to refresh."
  3. Check payload.sid === session_id. If not → 400 "QR belongs to a different class."
  4. Check student is in session's batch. If not → 403.
  5. Check no existing attendance row for (session_id, student_id). If exists → 409 "Already marked."
  6. Determine status:
       if now <= scheduled_start + 10min → 'present'
       else if now <= scheduled_start + 30min → 'late'
       else → 400 "Scan window closed."
  7. INSERT attendance row { method: 'qr', qr_token_jti: payload.jti, marked_by: teacher.id }.
  8. INSERT activity_days(student_id, today_IST) on conflict do nothing.
  9. Trigger mastery-recompute (idempotent).
  10. Realtime broadcast to room:session:{sid}:roster — teacher sees live count tick.
  11. Audit log.
  12. Return { status, student_name }.
```

### 4.5 Replay protection

`(session_id, student_id)` is **unique** in `attendance` — DB enforces "one row per pair". The `jti` is recorded but not used for uniqueness (the pair already covers it).

A scanned QR can never be reused even if the teacher rescans the same code — the second attempt hits the unique constraint and returns 409.

## 5. Manual Marking (Roster)

`(teacher)/roster/[sessionId].tsx`:

```
┌──────────────────────────────────────┐
│ Roster — Physics, 9:00 AM            │
│ [All Present] [All Absent]           │
├──────────────────────────────────────┤
│  Aarav Sharma     ◯ P  ◯ L  ◉ A      │
│  Priya Singh      ◉ P  ◯ L  ◯ A      │
│  Rohit Patel      ◯ P  ◯ L  ◯ A      │
│  ...                                 │
└──────────────────────────────────────┘
```

- Teacher taps a status pill per student. Changes are persisted on tap (optimistic + server upsert).
- Status options: P (Present), L (Late), A (Absent). Default to A until set.
- "All Present" / "All Absent" bulk: confirmation dialog, then sets every unmarked student to that status.
- Bulk is recorded as `method = 'manual'` with `marked_by = teacher`.
- Edits after a student was already QR-marked: see Corrections below.

## 6. Corrections

A student already marked can be corrected. UX: long-press a student row in roster → "Change status…" sheet.

```
attendance-correct edge fn
  caller = teacher (in session's batch) or admin
  input = { attendance_id, new_status, reason* }

  1. Verify caller authorized.
  2. Read current attendance row.
  3. INSERT attendance_corrections { prev_status, new_status, reason, changed_by }.
  4. UPDATE attendance SET status = new_status, method = 'correction'.
  5. Audit log.
```

`reason` required — UI prefills suggestions: "Late entry confirmed", "QR scan failed", "Teacher error", "Other".

## 7. Ad-hoc / Offline Classes (D-205)

For offline classes, makeup classes, or special revisions, the teacher creates a one-off session. Surfaced in the UI as **"New offline class"** (blue `+` FAB) and **"Schedule live class"** (red FAB) — both go through the same `session-create-ad-hoc` edge fn.

`(teacher)/classes.tsx` → "+" → "New offline class":
- **Class name** (required, ≤120 chars) — `sessions.title`. Shown to students/teachers everywhere via `sessionDisplayName(title, subject_name)` (`title || subject || "Class"`), so an offline class is recognisable even with no subject.
- Select batch (limited to assigned batches)
- **Date + start time** picker — schedule for now *or* any future slot (15-min steps). Web anchors to IST; mobile reuses the exam-builder picker.
- Duration → `scheduled_end`.
- "Schedule live class" sets `is_live_class = true` → live-control + `yt-broadcast-create`.

On save → `sessions` row with `is_ad_hoc = true` (+ `is_live_class` per mode). **Attendance works whether or not the class is live** — QR signing and the roster (manual P/L/A, bulk all-present/all-absent, un-mark, correction) work identically to materialized sessions. `attendance-manual-mark`/`-bulk-mark`/`-unmark` impose no time window; QR verify still enforces the present/late bands off `scheduled_start`.

## 8. Student-side Attendance UI

`(student)/attendance.tsx`:

```
┌──────────────────────────────────────┐
│ Today's Attendance                   │
│   Physics 09:00 — ✔ Present (QR)     │
│   Chem 11:00 — Awaiting (scan QR ↓)  │
│                                      │
│         ┌──────────────┐             │
│         │  ▓▓▓▓▓▓▓▓▓▓  │             │
│         │  QR CODE     │             │
│         │  rotating    │             │
│         └──────────────┘             │
│         Refreshes in 18s             │
│                                      │
│   Bio 14:00 — Upcoming               │
├──────────────────────────────────────┤
│ History                              │
│   This Week:  6 / 8 classes (75%)    │
│   This Month: 22 / 25 (88%)          │
│   [View detailed history]            │
└──────────────────────────────────────┘
```

- QR shown only for sessions within their scan window.
- Multiple sessions today → QR is for the *next* relevant session, with a session switcher.
- History tab: month grid (green / yellow / red dots per day) + list view.

## 9. Edge Cases

| Case | Behavior |
|---|---|
| Student in two scheduled sessions simultaneously (overlap) | Display QR for both, switcher; mark one doesn't block the other. |
| Network drops mid-scan (teacher) | Verify call retries with idempotency key (`jti` + `session_id`). Server returns same response. |
| Student's QR shown to a different teacher's scanner | Edge fn rejects on `sid` mismatch. |
| Two devices scan the same QR within the window | First wins; second gets 409. |
| Teacher scans their own (admin) QR | If admin doesn't belong to the batch → 403. |
| Session cancelled after some students marked | Attendance rows remain; status `cancelled` on session. Doesn't count toward attendance %. |
| Phone clock drift on student device | Irrelevant — `exp` is server-issued in UTC, verified server-side. |
| Phone clock drift on teacher device | Irrelevant — server time is authoritative. |
| Student tries to mark before session window | Edge fn refuses to sign. UI shows "QR available 15 min before class." |

## 10. Performance

- QR refresh: 1 fn call per 25s per student during the scan window. At 600 students with 3 classes each = ~ 18 calls/student/day. Negligible.
- Teacher scanning: ~ 30-40 scans in 5 minutes peak. Each verify is fast (single SELECT + single INSERT).

## 11. Security Considerations

- QR token HMAC secret rotated quarterly (old secret valid for 24h).
- HMAC verified server-side; tokens are short-lived (30s) so even leaked tokens are useless quickly.
- Replay protection via DB unique constraint.
- Window enforcement prevents pre-marking by minutes/hours.
- Manual marks audited via `marked_by` and `audit_log`.
- Corrections require reason — visible to admin in audit log.
- No raw student PII in the QR payload (`uid` is internal UUID, useless without DB access).

## 12. Telemetry

PostHog:
- `attendance_qr_shown` (student)
- `attendance_qr_verified` (teacher) with `{ status, session_id }`
- `attendance_manual_marked` (teacher) with `{ status }`
- `attendance_corrected` (teacher/admin) with `{ from, to, reason_category }`

## 13. Data Model Touchpoints

- `sessions` — defines scan window; `sessions.title` (nullable, ≤120 chars, D-205) holds the teacher-given class name
- `attendance` — primary record
- `attendance_corrections` — change history
- `activity_days` — streak feeder
- `audit_log` — every write

## 14. Edge Function Map

| Function | Caller | Action |
|---|---|---|
| `attendance-qr-sign` | Student | Issue 30s HMAC-signed QR payload |
| `attendance-qr-verify` | Teacher | Verify + mark present/late |
| `attendance-bulk-mark` | Teacher | Bulk set of unmarked students |
| `attendance-correct` | Teacher/Admin | Status change with audit |

## 15. Testing

- Unit: HMAC sign/verify, status determination by clock.
- Integration: full scan flow, expiry handling, replay rejection.
- E2E (Maestro): student shows QR, teacher scans (via simulated payload), attendance appears in student's history.

## 16. UI / Screens

| Screen | Path |
|---|---|
| Student QR + history | `app/(student)/attendance.tsx` |
| Teacher scanner | `app/(teacher)/scan.tsx` |
| Teacher roster | `app/(teacher)/roster/[sessionId].tsx` |
| New ad-hoc session | `app/(teacher)/classes.tsx?sheet=adhoc` |
| Attendance history (drill-down) | `app/(student)/attendance.tsx?tab=history` |

## 17. Open Items

- Should "late" status be visible to admin only or also to student? Defaulting to student-visible.
- Should we expose the rotation interval (30s) to the student so they understand why the QR changes? Defaulting to a tiny countdown label below the QR.
