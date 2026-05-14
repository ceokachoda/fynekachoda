# Spec: Examinations (Graded Exams)

Teacher-scheduled, timed, synchronized-start, server-enforced, hard-cut MCQ tests. Grades feed mastery and parents' reports. Distinct from practice quizzes — exams are higher-stakes, locked-down, and results-released-on-teacher-approval.

---

## 1. Goals

- Teacher creates, schedules, and releases exams per batch.
- Student-side experience is **locked down** during attempt — clear timer, app-switch warning, no result preview.
- Server is the only timekeeper that matters.
- Tab/app switching tracked but not auto-submitting (warn loudly, log count).
- Auto-submit when timer expires.
- Results released manually by teacher (so students can't share answers mid-window).
- Teachers can regrade questions post-release (with audit).
- Question bank reused; offline test scores entered separately.

## 2. Non-Goals (MVP)

- Proctoring with webcam / face match.
- Adaptive difficulty.
- Subjective (long-answer) questions.
- OMR scanning of paper exams.
- Multi-section exams with section-level timers.

## 3. Anatomy of an Exam

| Field | Notes |
|---|---|
| `title` | "Unit Test 4 — Mechanics" |
| `batch_id` | One batch per exam. Same exam for multiple batches = duplicate. |
| `starts_at` | Synchronized start time. |
| `duration_min` | Hard cap. |
| `marks_correct`, `marks_wrong`, `marks_skip` | Defaults +4 / -1 / 0; configurable. |
| `randomize_questions`, `randomize_options` | Defaults true. |
| `result_release` | `'manual'` (default) or `'instant'`. |
| `is_published` | Visible to students only when true AND now ≥ starts_at - 24h (preview window). |

## 4. Authoring

`(teacher)/exam-builder.tsx`:

```
┌──────────────────────────────────────┐
│ New Exam                             │
│ Title:    [Unit Test 4 — Mechanics]  │
│ Batch:    [NEET 2027 Morning ▾]      │
│ Starts:   [Sat, 18 May 09:00 IST]    │
│ Duration: [60] minutes               │
├──────────────────────────────────────┤
│ Marking:                             │
│   +4 / -1 / 0                        │
│   ☑ Randomize question order         │
│   ☑ Randomize option order           │
│ Results:                             │
│   ◉ Release manually after exam      │
│   ◯ Release instantly on submit      │
├──────────────────────────────────────┤
│ Questions (drag to reorder):         │
│   1. A sphere of mass… [edit][remove]│
│   2. …                               │
│   [+ From Question Bank]             │
│   [+ New Question]                   │
├──────────────────────────────────────┤
│ [Save Draft]  [Publish]              │
└──────────────────────────────────────┘
```

After Publish:
- Students in the batch see the exam in `(student)/classes.tsx > Exams tab` 24h before start, with countdown.
- Notifications (future): "Exam in 1h", "Exam starting now".

Edits after publish: allowed up to `starts_at - 1h`. After that the exam is frozen.

## 5. Student-side: Pre-exam

Exam card on dashboard/classes:

```
┌──────────────────────────────────────┐
│ Unit Test 4 — Mechanics              │
│ Sat, 18 May • 09:00 IST              │
│ 30 questions • 60 min                │
│ Starts in 02h 14m                    │
└──────────────────────────────────────┘
```

At `starts_at`:

```
┌──────────────────────────────────────┐
│ Unit Test 4 — Mechanics              │
│ ●  Live now                          │
│         [Enter Exam]                 │
└──────────────────────────────────────┘
```

Tapping "Enter Exam":
- Calls `exam-start` edge fn.
- Server creates `exam_attempts` row with `started_at = now()`.
- Server snapshots question + option order into `metadata` (so refresh doesn't reshuffle).
- Server returns the question payload (without `is_correct`).
- App enters locked-down attempt UI.

If the student enters late (e.g., 15 min after start), `started_at` is **now**, but the hard cut is still `starts_at + duration_min`. They lose the lost minutes.

If `now > starts_at + duration_min`, attempt is blocked: "Exam has ended."

## 6. Attempt UI

Looks similar to quiz but with locked-down chrome:

```
┌──────────────────────────────────────┐
│      Unit Test 4         ⏱ 47:22     │ ← server-synced
├──────────────────────────────────────┤
│ Q 7 / 30                             │
│                                      │
│ A sphere is thrown vertically up…    │
│                                      │
│  ○ A) 5 m/s                          │
│  ○ B) 10 m/s                         │
│  ◉ C) 15 m/s                         │
│  ○ D) 20 m/s                         │
├──────────────────────────────────────┤
│  🚩 Flag for review                  │
│  [Previous] [Save & Next]            │
├──────────────────────────────────────┤
│  Q grid (color coded)                │
│  [    SUBMIT EXAM    ]               │
└──────────────────────────────────────┘
```

Differences from practice quiz UI:
- No "Solution" or "Related video" buttons.
- No "Pause" — exam is continuous.
- A persistent banner if app-switch was detected: "⚠ You left the app. Switches: 2."
- Submit button persistent at the bottom of the Q grid.

### 6.1 Tab/app-switch detection

Uses `AppState` listener (React Native):
- On state change `active → background` or `active → inactive`, increment local counter and POST to `exam-tab-switch` edge fn (fire-and-forget).
- Edge fn increments `exam_attempts.tab_switch_count`.
- On return to active, show warning toast.
- After 3 switches: full-screen warning, "Further switches may be reviewed by your teacher."
- **No auto-submit** — pure logging + soft warning.
- Teachers see `tab_switch_count` in results.

### 6.2 Auto-save

Same as practice quiz — every option select / flag toggles upserts `exam_answers`. Optimistic + retry.

### 6.3 Server-time enforcement

Client displays the timer based on `started_at + duration_min - server_now`.
`server_now` synced via a periodic `/functions/v1/server-time` call (every 60s).
Visual countdown shows remaining time.

When client thinks `remaining ≤ 0`:
- Disables answer UI.
- Auto-calls `exam-submit` with whatever is saved.
- If client misses the deadline (app killed), the next "Enter Exam" attempt is blocked because server sees `now > starts_at + duration_min`. Server will auto-submit on the next admin/cron sweep (or on first read).

### 6.4 Submit

- "Submit Exam" button → confirmation modal: "You've answered 22/30, flagged 5. Submit?"
- Calls `exam-submit` edge fn.
- Edge fn:
  - Validates attempt; rejects if `submitted_at IS NOT NULL`.
  - **Server-time check**: if `now > starts_at + duration_min`, sets `auto_submitted = true`.
  - Grades using `question_options.is_correct`.
  - Writes `score`, `max_score`, `submitted_at`.
  - If `result_release = 'instant'` → result shown immediately.
  - If `result_release = 'manual'` → student sees "Submitted. Results will be released by your teacher."
  - Recomputes mastery.
  - Audit log.
- Student returned to a "Submitted" confirmation screen.

## 7. Result Release (Teacher)

`(teacher)/exam/[id]/results.tsx`:

```
┌──────────────────────────────────────┐
│ Unit Test 4 — Mechanics              │
│ Status: Submissions closed           │
│ Released: ☐ (not released)           │
├──────────────────────────────────────┤
│ Roster (30 students):                │
│  Aarav      28/120  🚨 tab×4         │
│  Priya      96/120                   │
│  ...                                 │
├──────────────────────────────────────┤
│ Question Analysis:                   │
│  Q7 — 12% correct  [review]          │
│  Q19 — 22% correct [review]          │
├──────────────────────────────────────┤
│  [Release Results to Students]       │
│  [Regrade a Question]                │
└──────────────────────────────────────┘
```

Release:
- Sets `exams.results_released_at = now()`.
- Students in batch get instant access on next view (or push notification if/when wired).

Regrade:
- Teacher selects a question → marks a different option correct (or "no correct option" → everyone gets the marks).
- `exam-regrade` edge fn: updates `question_options.is_correct`, walks all attempts in this exam, recomputes scores, writes audit log entry.

## 8. Student-side Result View

If released:

```
┌──────────────────────────────────────┐
│ Unit Test 4 — Mechanics              │
│ Score: 96 / 120 (80%)                │
│ Batch rank: 3 / 30                   │
│ Submitted: 22 May 09:55              │
│                                      │
│ Correct: 25  Wrong: 4  Skipped: 1    │
│                                      │
│   [View Question-by-Question]        │
└──────────────────────────────────────┘
```

Per-question view shows correct vs. selected, explanation, related video (same as practice quiz solution view).

## 9. Offline Test Scores

Separate flow but documented here because it's adjacent.

`(teacher)/offline-scores.tsx`:

```
┌──────────────────────────────────────┐
│ Offline Test Entry                   │
│ Batch:  [NEET 2027 Morning ▾]        │
│ Test:   [Weekly Test 12]             │
│ Date:   [12 May 2026]                │
│ Subject:[Physics ▾]                  │
│ Max:    [80]                         │
├──────────────────────────────────────┤
│  Aarav    [ 64 ]                     │
│  Priya    [ 71 ]                     │
│  Rohit    [ 58 ]                     │
│  ...                                 │
│   [Save All]                         │
└──────────────────────────────────────┘
```

- Inserts `offline_test_scores` rows.
- Visible to admin and student (read-only).
- Feeds into parent report and mastery (averaged by subject, light contribution).

## 10. State Machines

**Exam attempt:**
```
not_started → started → submitted (manual)
                     ↓
                     → auto_submitted (timer)
```

**Exam lifecycle:**
```
draft → published → live (within window) → closed → results_released
```

## 11. Edge Cases

| Case | Behavior |
|---|---|
| Student enters exam, kills app, comes back | Reopens to current state; timer continues; answers persist. |
| Phone dies mid-exam | On re-launch, if window still open, resume. Otherwise blocked + auto-submit on next sweep. |
| Network drops during submit | Client retries with same payload until success. Idempotent on `(exam_id, student_id)`. |
| Two devices, one student | Each device sees the same attempt (same `exam_attempts` row). Last-write-wins on answer upserts. Tab switches count from both. (Strict single-device enforcement deferred.) |
| Student enters exam after end | Server returns 400 "Exam has ended". |
| Teacher edits a question after attempts started | Allowed only via `exam-regrade` — re-runs grading and audits. |
| Teacher unpublishes mid-exam | All open attempts can still submit; new entries blocked. |

## 12. Anti-Cheating Posture (Honest Disclosure)

This is MVP; we do not pretend to be ETS or NEET-board proctoring. What we do:
- Server-side timer (uncheatable via phone clock).
- App-switch logging visible to teacher.
- Question-order + option-order randomization (different students get different sequences).
- Answer correctness never sent to client until release.
- Auto-submit on timeout.

What we explicitly do NOT do (and tell teachers so they can set policy):
- Block screen recording (Android can't, fundamentally).
- Block screenshots (we can on iOS partially; not on Android).
- Detect a second device.
- Verify identity via camera.

Teachers running high-stakes exams should conduct them in physical presence — the app is the tool, the proctoring is human.

## 13. Telemetry

- `exam_published` (teacher)
- `exam_started` (student) `{ exam_id }`
- `exam_answer_changed`
- `exam_tab_switch` `{ count }`
- `exam_submitted` `{ score, max_score, auto_submitted, tab_switch_count }`
- `exam_results_released` (teacher)
- `exam_regrade` (teacher) `{ question_id }`

## 14. Security Considerations

- Same as practice quizzes (correct answers never sent pre-submit).
- Additional: only the assigned batch's students can `exam-start` for an exam (enforced by edge fn + RLS).
- `exam-submit` only mutates `exam_attempts` where `student_id = caller`.
- Regrade and release are gated by teacher role + batch ownership.

## 15. Data Model Touchpoints

- `exams`, `exam_questions`, `exam_attempts`, `exam_answers`
- `questions`, `question_options`, `question_solutions`
- `offline_test_scores`
- `mastery`, `activity_days`
- `audit_log`

## 16. Edge Function Map

| Function | Caller | Action |
|---|---|---|
| `exam-start` | Student | Create attempt row + snapshot order |
| `exam-tab-switch` | Student | Bump counter (fire-and-forget) |
| `exam-submit` | Student | Grade + write result |
| `exam-release-results` | Teacher | Flip `results_released_at` |
| `exam-regrade` | Teacher | Mutate `is_correct`, recompute attempts |

## 17. UI / Screens

| Screen | Path |
|---|---|
| Exam list (student) | `app/(student)/classes.tsx?tab=exams` |
| Exam pre-start (countdown) | `app/(student)/exam/[id].tsx?stage=pre` |
| Exam attempt | `app/(student)/exam/[id].tsx?stage=attempt` |
| Exam submitted (no results yet) | `app/(student)/exam/[id].tsx?stage=submitted` |
| Exam result | `app/(student)/exam/[id].tsx?stage=result` |
| Exam builder | `app/(teacher)/exam-builder.tsx` |
| Teacher results | `app/(teacher)/exam/[id]/results.tsx` |
| Offline scores | `app/(teacher)/offline-scores.tsx` |

## 18. Open Items

- Should we let students see their **rank** before results are released? Defaulting to no (rank is part of the result).
- "Review my submitted answers" before submission (a final-review step) — implemented as the Q-grid view; could be elevated to its own modal.
- "Bookmark this question" for post-exam practice — nice to have, deferred.
