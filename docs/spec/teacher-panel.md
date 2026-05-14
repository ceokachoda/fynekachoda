# Spec: Teacher Panel (Mobile, Role-Gated)

Teachers use the **same** React Native app as students. Role gating switches the route group to `(teacher)/*`. This spec documents the teacher-only flows. Most heavy-content features (attendance, exams, live classes) have their own specs; this file is the catalog and the unique teacher-only screens.

---

## 1. Goals

- A teacher logs in and lands on a dashboard tuned to "what needs my attention today".
- Quick paths to the four highest-frequency tasks: take attendance, start class, build exam, see results.
- Authoring (quiz, exam, content) is comfortable on a phone — bigger touch targets, less text entry where possible.
- Same auth + session model as students.

## 2. Non-Goals (MVP)

- Teacher-only desktop/web client (admin panel covers web).
- Group messaging between teachers.
- Teacher payroll / hours tracking.
- Bulk grading from CSV imports.

## 3. Permissions Summary

A `teacher` role can:
- Read all students in batches they're assigned to.
- Mark attendance / corrections in their batches' sessions.
- Schedule + run live classes for their batches.
- Create/edit/delete quizzes scoped to their batches (or course-wide as suggest-to-admin).
- Create/edit exams scoped to their batches.
- Upload content to their batches.
- Enter offline test scores for their batches.
- Trigger parent reports on-demand for their students.
- Edit their own profile.

A teacher **cannot**:
- Create/delete other users.
- View batches they're not assigned to.
- Promote content to course-wide (admin only).
- Change a student's batch.
- Change marking schemes globally.

## 4. Information Architecture

`(teacher)/_layout.tsx` bottom tabs:

```
[Home]  [Classes]  [Library]  [Batch]  [Profile]
```

- **Home** — teacher dashboard (today's tasks)
- **Classes** — schedule + create live + scanner shortcut
- **Library** — same library as students, plus upload affordance
- **Batch** — switcher across assigned batches; per-batch performance dashboard
- **Profile** — same as student profile, plus role indicator

## 5. Home (Teacher Dashboard)

`(teacher)/index.tsx`:

```
┌──────────────────────────────────────┐
│ Hi, Mr. Sharma                       │
│ Today: Mon, 12 May                   │
├──────────────────────────────────────┤
│ NEXT                                 │
│  Physics — NEET 2027 Morning         │
│  Live in 18 min                      │
│  [Go Live]  [Take Attendance]        │
├──────────────────────────────────────┤
│ PENDING                              │
│  • Release results: Unit Test 3      │
│  • Enter offline scores: WT-12 Chem  │
│  • Review 3 raised hands             │
├──────────────────────────────────────┤
│ TODAY'S CLASSES                      │
│  09:00 Physics (NEET Morning) ●Live  │
│  11:00 Chem    (JEE Evening)  Pending│
├──────────────────────────────────────┤
│ QUICK ACTIONS                        │
│  [Scan QR] [New Exam] [Upload]       │
└──────────────────────────────────────┘
```

Pending list query: derived from `exam_attempts` awaiting result release + missing `offline_test_scores` for recent tests + unresolved `raise_hand_events`.

## 6. Classes (Teacher)

`(teacher)/classes.tsx`:

- Segmented: **Today** / **Upcoming** / **Past**
- Each row shows scheduled time, batch, subject, status (Scheduled / Live / Ended).
- Live: tap → `(teacher)/live-control/[sessionId]`
- Scheduled in future: tap → preview + ability to edit (until 1h before start)
- Ended: tap → recording link + attendance summary
- "+" FAB: schedule live class OR create ad-hoc session.

## 7. Scan QR

`(teacher)/scan.tsx` — described in detail in `attendance.md`. Highlights:
- Open camera, scan in landscape if preferred.
- Top picker: which session am I marking? Defaults to nearest live/upcoming in assigned batches.
- Continuous scan mode (multi-student).
- Sound + haptic feedback per scan.
- "Switch to Roster" button to flip into manual mode for the same session.

## 8. Quiz Builder

`(teacher)/quiz-builder.tsx` — see `practice-quizzes.md` for the full form.

Phone-tuned UX:
- Form sections are accordion-collapsible.
- Question editor uses bottom-sheet modal for adding new questions so the parent list stays visible.
- "Add from bank" opens a filterable list with topic chips.

## 9. Exam Builder

`(teacher)/exam-builder.tsx` — see `examinations.md`.

Teacher can:
- Pick `starts_at` (date + time picker; rounded to 15 min).
- Pick `duration_min` (preset options 30 / 45 / 60 / 90 / 120 / custom).
- Pick batches (single only in MVP).
- Decide result release timing.
- Save draft or publish.

## 10. Results & Regrade

`(teacher)/exam/[id]/results.tsx` — see `examinations.md`.

## 11. Content Upload

`(teacher)/content.tsx` — see `study-materials.md`. Phone-tuned upload form; large file pickers; progress bar; max 50 MB.

## 12. Offline Test Scores

`(teacher)/offline-scores.tsx`:

- Pick a batch.
- Add a test (name, date, subject, max marks).
- Roster table with a numeric input per student.
- "Save All" persists `offline_test_scores` rows.
- Phone keyboard set to numeric.
- Validation: 0 ≤ score ≤ max_score.
- Bulk paste from CSV (later phase).

## 13. Batch Dashboard

`(teacher)/batch/[id].tsx`:

```
┌──────────────────────────────────────┐
│ NEET 2027 Morning           32 stud. │
│ [Attendance] [Mastery] [Risk]        │
├──────────────────────────────────────┤
│  Attendance heatmap                  │
│  (30-day grid; green/yellow/red)     │
├──────────────────────────────────────┤
│  Topic mastery (avg)                 │
│   Mechanics       72%                │
│   Optics          65%                │
│   Thermodynamics  58%   🚨           │
├──────────────────────────────────────┤
│  Students at risk (composite < 0.4)  │
│   • Aarav    Attn 60%  Quiz avg 42%  │
│       [Send parent report]           │
│       [Note]                         │
└──────────────────────────────────────┘
```

Tabs:
- **Attendance** — heatmap by date, drill into a specific session.
- **Mastery** — bar chart of topic averages.
- **Risk** — students with composite < 0.4 OR mastery < 40% in any subject they study.

Each risk row has quick actions: send report, write a teacher note, view full student profile.

## 14. Per-student View (Teacher)

`(teacher)/batch/[id].tsx?student=...`:
- Read-only profile
- Attendance history
- Quiz + exam history
- Offline test scores
- Streak + badges
- Teacher note editor (`teacher_notes` table) — persisted by period

## 15. Live Control

`(teacher)/live-control/[sessionId].tsx` — see `youtube-live-stream.md`.

## 16. Profile (Teacher)

Same general layout as student profile (see `spec/student-dashboard.md §11A`). Identity fields are read-only per D-016:

- Editable by teacher: `avatar`, `bio`, `password`, MFA enrollment, display preferences.
- Read-only (admin only): `full_name`, `email`, `phone`, `dob`, `subjects[]`, assigned batches.

Shown:
- Role badge "Teacher" / "Teacher · Admin" (multi-role)
- Subjects taught (read-only chip list)
- Bio (editable textarea, max 500 chars)
- Assigned batches (read-only list with last-30-day attendance % per batch)
- Account settings (Change password, MFA toggle)
- "Contact admin" link for identity-change requests

## 17. Role Switch (Dual-Role Users)

If a user has both `teacher` and `student` roles, a "Switch role" item appears in the menu. Tapping reloads the layout into the other group. Tokens stay the same.

If a user has `staff_admin` role only, mobile app shows "Please log in via the web admin panel."

## 18. Empty / Loading

Standard skeleton loaders. Empty teacher dashboard (first day, no batches yet): "Welcome! Once your admin assigns you to a batch, you'll see classes here. Meanwhile, explore the Library."

## 19. Telemetry

- `teacher_dashboard_viewed`
- `teacher_quick_action` `{ action: 'scan_qr'|'new_exam'|'upload' }`
- `teacher_batch_viewed` `{ batch_id }`
- `teacher_note_saved`
- `teacher_offline_score_saved`

## 20. Security Considerations

- All teacher reads enforced by RLS (`batch_teachers` join).
- All teacher writes go through edge functions or RLS-permitted upserts limited to their assigned batches.
- Audit log on every write action.
- Teachers cannot see students' raw passwords or auth.users rows.
- Teacher MFA optional; can be required via admin setting.

## 21. Data Model Touchpoints

- `teachers`, `batch_teachers`
- All student data tables (read-scoped to their batches via RLS)
- `teacher_notes` for per-student notes

## 22. UI / Screens

| Screen | Path |
|---|---|
| Teacher home | `app/(teacher)/index.tsx` |
| Classes list | `app/(teacher)/classes.tsx` |
| QR Scanner | `app/(teacher)/scan.tsx` |
| Roster | `app/(teacher)/roster/[sessionId].tsx` |
| Live control | `app/(teacher)/live-control/[sessionId].tsx` |
| Quiz builder | `app/(teacher)/quiz-builder.tsx` |
| Exam builder | `app/(teacher)/exam-builder.tsx` |
| Exam results | `app/(teacher)/exam/[id]/results.tsx` |
| Content upload | `app/(teacher)/content.tsx` |
| Offline scores | `app/(teacher)/offline-scores.tsx` |
| Batch dashboard | `app/(teacher)/batch/[id].tsx` |

## 23. Open Items

- A teacher with multiple batches needs a quick batch switcher in the header. Default location: top-right dropdown on Home + Batch tabs.
- Should teachers be able to bulk-import questions from CSV? Defer.
- Teacher chat with admin — out of MVP.
