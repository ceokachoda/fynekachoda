# Spec: Practice Quizzes

Self-paced, retakeable, chapter- or topic-bound MCQ sets. Students take them whenever they want; the goal is mastery practice, not grading. After submission, students see a solution view with explanation and a "Related video" deep link.

---

## 1. Goals

- Teachers author quizzes from the question bank.
- Students can attempt any published quiz at any time, unlimited retakes.
- In-attempt UX is fast: flag for review, navigation grid, timer.
- Auto-save partial answers so backgrounding or losing connection doesn't lose progress.
- Submitted attempts feed mastery.
- Solutions view is the learning moment — explanation + linked video.

## 2. Non-Goals (MVP)

- Adaptive quizzing / AI difficulty tuning.
- Real-time competitive quizzes.
- Voice-input answers.
- Group quizzes.

## 3. Anatomy of a Quiz

| Field | Notes |
|---|---|
| `title` | "Vectors — Quick 15" |
| `topic_id` or `chapter_id` | One of the two. Topic preferred for tight scoping. |
| `batch_id` | Visibility scope. `null` = visible to entire course. |
| `duration_min` | Default 20. |
| `marks_correct`, `marks_wrong`, `marks_skip` | Default `+4 / -1 / 0`. Teacher-configurable per quiz. |
| `randomize_questions` | Default true. |
| `randomize_options` | Default true. |
| `is_published` | Defaults false. Teachers can save drafts. |

Quizzes pull questions from `questions` table via `quiz_questions` join. Each question has `question_options[]` and `question_solutions` (explanation + optional related content).

## 4. Authoring (Teacher)

`(teacher)/quiz-builder.tsx`:

```
┌──────────────────────────────────────┐
│ New Quiz                             │
│ Title: [_______________________]     │
│ Scope: ◯ Topic ◉ Chapter             │
│ Chapter: [Kinematics ▾]              │
│ Visibility: ◉ My Batch ◯ Course-wide │
├──────────────────────────────────────┤
│ Rules:                               │
│   Duration: [20] min                 │
│   Correct: [+4]  Wrong: [-1]  Skip: [0] │
│   ☑ Randomize question order         │
│   ☑ Randomize option order           │
├──────────────────────────────────────┤
│ Questions (drag to reorder):         │
│   1. A sphere is thrown… [edit]      │
│   2. Two vectors A and B… [edit]     │
│   [+ Add from bank]  [+ New question]│
├──────────────────────────────────────┤
│  [Save Draft]   [Publish]            │
└──────────────────────────────────────┘
```

Adding from bank: searchable list of `questions` filtered by topic/chapter/difficulty.

Creating new: inline editor (Markdown with KaTeX), 2-6 options, mark correct, add explanation, optionally pick a related video from `content_items` (kind=video).

On Publish: `is_published = true`. Visible to students in the scope.

## 5. Student Discovery

Quizzes appear inside the library at the topic level:

```
Library → Physics → Kinematics → Projectile Motion
   • Video: Intro to Projectile Motion
   • Notes (PDF)
   • Quiz: Quick 15 ●●●●  (attempted 3x, best 92%)
   • Quiz: Hard 10 ●●○○   (attempted 1x, best 60%)
```

The dashboard "Weak Topics" cards also surface quizzes directly.

## 6. Attempt Flow

`(student)/quiz/[id].tsx`:

### 6.1 Start screen

```
┌──────────────────────────────────────┐
│ Vectors — Quick 15                   │
│                                      │
│  15 questions • 20 minutes           │
│  +4 / -1 marking                     │
│  Total: 60 marks                     │
│                                      │
│  Your best: 48 / 60                  │
│  Last attempt: 3 days ago            │
│                                      │
│         [Start Quiz]                 │
└──────────────────────────────────────┘
```

On Start tap:
- Create `quiz_attempts` row with `started_at = now()`.
- Generate option-order snapshot (if `randomize_options`) and question-order snapshot — persisted in `metadata` so refresh / app kill resumes in the same order.
- Navigate to question 1.

### 6.2 Question screen

```
┌──────────────────────────────────────┐
│ ◀ Quiz                       17:42 ⏱ │
├──────────────────────────────────────┤
│ Q3 / 15                              │
│                                      │
│ A sphere of mass 2 kg is thrown at   │
│ an angle of 30° with horizontal…     │
│                                      │
│  ○ A) 5 m/s²                         │
│  ◉ B) 10 m/s²                        │
│  ○ C) 15 m/s²                        │
│  ○ D) 20 m/s²                        │
├──────────────────────────────────────┤
│  🚩 Flag for review                  │
│                                      │
│  [Previous]  [Save & Next]           │
├──────────────────────────────────────┤
│  Q grid: 1✔ 2✔ 3● 4◯ 5🚩 ...          │
└──────────────────────────────────────┘
```

- Question prompt + image (if any) rendered with KaTeX support.
- 4 options (or variable count per question) as radio buttons.
- Flag toggle.
- Timer (server-synced).
- Q grid: tap any number to jump.
- Q grid color codes:
  - White = unattempted
  - Green = answered
  - Red = answered + flagged
  - Yellow = unanswered + flagged
  - Filled circle = current

### 6.3 Auto-save

Every action (option select, flag toggle) immediately upserts a `quiz_answers` row. Optimistic UI; queued retry on network failure. No "save" needed.

### 6.4 Pause / resume

User can leave the screen. Resuming:
- Reads `quiz_attempts` row; if `submitted_at is null` and `started_at + duration_min > now`, resumes.
- Server timer continues — no reset.
- Once past the duration window, on resume the attempt is auto-submitted by `quiz-submit` edge fn.

### 6.5 Submission

User taps "Submit". Confirmation modal: "You've answered 12/15, flagged 2. Submit anyway?"
- POST to `quiz-submit` edge fn.
- Edge fn:
  - Validates: attempt exists, not already submitted.
  - Grades against `question_options.is_correct`.
  - Writes `score`, `max_score`, `submitted_at`.
  - Calls `mastery-recompute`.
  - Inserts `activity_days` row.
  - Returns score breakdown.

### 6.6 Result screen

```
┌──────────────────────────────────────┐
│ Score: 48 / 60                       │
│ Time: 16:34 / 20:00                  │
│                                      │
│ Correct: 13  Wrong: 1  Skipped: 1    │
│                                      │
│   [View Solutions]                   │
│   [Retake]                           │
│   [Next Chapter]                     │
└──────────────────────────────────────┘
```

### 6.7 Solution view

Per-question card showing:
- The student's selected option (highlighted red if wrong, green if right).
- Correct option highlighted green.
- Explanation (Markdown + KaTeX).
- "Related video" button if linked → opens the linked content item.

Navigation: swipe / Q grid.

## 7. State Machine

```
not_started → started → submitted
                  │
                  └→ auto_submitted (time expired)
```

Re-attempt: a *new* `quiz_attempts` row is created. Best score across attempts shown on the start screen.

## 8. Mastery Contribution

Each submitted attempt contributes one data point:
- For every distinct topic represented in the quiz, score % is added to that topic's pool.
- `mastery-recompute` walks back through the last 5 attempts (combined quiz + exam) per `(student, topic)`.
- Only attempts where `submitted_at IS NOT NULL` count.

## 9. Edge Cases

| Case | Behavior |
|---|---|
| Student starts a quiz then teacher unpublishes it | In-progress attempts can still be submitted; new attempts blocked. |
| Quiz questions edited after a student started | Snapshot of question_ids was taken at start; edits to question content reflect immediately (no version pinning in MVP). |
| Student submits with 0 answers | Allowed; score = 0; recorded normally. |
| Two devices same student in one attempt | Last write wins per `quiz_answers` primary key. Active session limited to 1 device via auth refresh fingerprint (later phase). |
| Time expires while student is on the solution view | N/A — solution view is post-submit. |

## 10. Telemetry

- `quiz_started` `{ quiz_id }`
- `quiz_answer_changed` `{ quiz_id, question_id, flagged }`
- `quiz_flag_toggled`
- `quiz_submitted` `{ score, max_score, time_taken_sec }`
- `quiz_solution_viewed`
- `quiz_related_video_opened`

## 11. Security Considerations

- Correct answers never leak to the client until after submit. Client receives only `question_options.id + text` — no `is_correct`. Grading is fully server-side.
- Question-text leaks aren't a concern for practice (low stakes), but the same RLS hides them outside an active attempt anyway.
- Submitting an attempt that doesn't belong to the caller fails RLS.

## 12. Data Model Touchpoints

- `quizzes`, `quiz_questions`, `quiz_attempts`, `quiz_answers`
- `questions`, `question_options`, `question_solutions`
- `mastery` (downstream)
- `activity_days` (downstream)

## 13. Edge Function Map

| Function | Caller | Purpose |
|---|---|---|
| `quiz-start` | Student | Validates, creates `quiz_attempts` row, returns snapshot |
| `quiz-submit` | Student | Grades, writes score, triggers mastery |

(Many quiz operations — option selection, flag — go directly to Supabase via RLS-controlled upsert; no edge fn needed for those.)

## 14. UI / Screens

| Screen | Path |
|---|---|
| Start screen | `app/(student)/quiz/[id].tsx?stage=intro` |
| Question | `app/(student)/quiz/[id].tsx?stage=attempt&q=3` |
| Submit confirm modal | `app/modal.tsx?type=quiz-submit` |
| Result | `app/(student)/quiz/[id].tsx?stage=result` |
| Solution | `app/(student)/quiz/[id].tsx?stage=solution&q=1` |
| Quiz builder (teacher) | `app/(teacher)/quiz-builder.tsx` |

## 15. Open Items

- Question versioning: deferred. If a teacher edits a question while students have it in progress, students see the edit immediately. For exams this would be a problem — exams pin question content at attempt start (see `examinations.md`).
- Difficulty filter on quiz start: nice-to-have, deferred.
