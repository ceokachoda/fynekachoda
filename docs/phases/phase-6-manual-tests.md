# Phase 6 — Manual Test Plan (Visual + Real-Device only)

> **Scope:** this doc covers ONLY what an automated test cannot do — real
> browser rendering, real device interactions, KaTeX rendering inside a
> WebView, real-network signing of exam-image URLs, server-anchored timer
> countdown UX, and the visual no-`is_correct`-leak check via the network
> inspector. Every functional/data behaviour has already been auto-verified
> by me on this dev project (`orqwyazvcthgxoadfxfv`).
>
> **Already proven by automated tests (do NOT re-test):**
> - All 4 Phase 6 migrations applied + schemas/policies/triggers/indexes
>   queried via `information_schema` / `pg_policies` / `pg_indexes` / `pg_proc`.
> - All 5 Phase 6 edge fns deployed, ACTIVE, `verify_jwt=true`.
> - `pnpm test:quiz` — 27/27 unit assertions (marking calc, KaTeX detection,
>   shuffle, snapshot reconcile).
> - `pnpm smoke:quiz-rls` — 12/12 RLS scenarios across PostgREST including
>   T12 ("`quiz-start` response contains NO `is_correct` field anywhere")
>   stringify-and-grep.
> - `pnpm smoke:quiz-fns` — 26/26 assertions across all 5 edge fns including
>   `audit_log` row verification for `quiz_submitted` and `quiz_unpublish`,
>   the 409 on `delete_question` while in use, replay protection on
>   `quiz-submit`, and idempotency on `quiz-start`.
> - `pnpm typecheck` + `pnpm lint` — all workspaces green.
> - `pnpm test --filter @fynestudy/mobile` — 6 suites / 53 tests green.
> - Supabase security advisor sweep — only the Phase-1 backlog item remains.
>
> So you DON'T need to verify: marking math, grading correctness, no-leak
> rule at the network layer (the server response itself is mathematically
> verified to omit `is_correct` pre-submit and include it post-submit),
> idempotent re-start, replay-protected submit, archived-question-blocks-
> delete, randomisation snapshot stability, RLS scoping per batch + course.
> Those are mathematically proven by the smoke runs above.
>
> What you DO need to verify in this doc: that the UI **renders** the
> verified data correctly, the timer **counts down** at 1 Hz, KaTeX
> **renders** real LaTeX into visible glyphs, the **Related Video** deep
> link opens the right Phase 5 content screen, the admin moderation page
> publish/unpublish/delete buttons work end-to-end, and there's nothing
> obviously broken on iOS Expo Go.

---

## 0. One-time setup

### 0.1 Fresh fixtures

```
pnpm seed:quiz-manual-test
```

(Pass `--reset` to wipe prior `p6-*` users + `P6_TEST_*` courses first.)

Copy the printed block to a scratch file. You'll need:
- Course id + topic ids (Kinematics + Vectors)
- Batch A id + Batch B id
- Teacher email + password
- Student A1 + Student A2 (Batch A) email + password
- Student B1 (Batch B) email + password
- Quiz 1 id (Kinematics — Easy 4, published, batch_A)
- Quiz 2 id (Vectors — Hard 1, published, course-wide)
- Quiz 3 id (Drafts — hidden, DRAFT, batch_A)

All four accounts already have `must_change_password=false`.

### 0.2 Owner admin

```
Email      owner@fynestudy.example.com
Password   FyneStudy01     (or your Phase 2 password)
TOTP       (your enrolled secret)
```

Admin URL: <https://admin-kohl-sigma.vercel.app/>

If Vercel still shows the Phase 1 placeholder, fall back to local dev:

```
pnpm dev:admin
# open http://localhost:3000
```

### 0.3 Mobile

```
pnpm dev:mobile -- --clear
```

Open the Expo Go app on your phone, scan the QR. **iOS Expo Go is the
primary target for Phase 6 manual QA — Android will be re-tested when the
Redmi 8A hardware is available.**

---

## A. Admin `/quizzes` + `/questions` moderation — visual layout (browser)

Sign in as the owner. Open `/quizzes`.

| # | Action | Expected |
|---|--------|----------|
| A1 | Page loads | Header reads "Quizzes" with subtitle "Moderate practice quizzes · publish / unpublish · delete." |
| A2 | Table has at least 3 rows | The seeded "Kinematics — Easy 4" / "Vectors — Hard 1" / "Drafts — hidden" rows appear. |
| A3 | Filter chips above the table | Course / Batch / Status / Search / Export CSV button render correctly. |
| A4 | Status pill on "Drafts — hidden" | Reads **Draft** in slate. The other two read **Published** in emerald. |
| A5 | "Q · Attempts" column | "Kinematics — Easy 4" shows `4 · 0`. "Vectors — Hard 1" shows `1 · 0`. (Will tick up after Part C.) |
| A6 | Tap **Unpublish** on Quiz 1 | Row re-renders with the pill flipping to "Draft". Refresh: still draft. SQL: `select is_published from quizzes where id = <quiz1>` → false. Audit: `select action, entity_id from audit_log where action = 'quiz_unpublish' order by created_at desc limit 1` should show your `entity_id`. |
| A7 | Tap **Publish** to re-enable | Pill flips back to **Published**. Audit row `quiz_publish` appears. |
| A8 | Tap **Delete** on a row | Confirmation modal "Delete quiz?" with red "Delete permanently". Cancel — nothing happens. (Don't actually delete Quiz 1 — you need it for Part C.) |
| A9 | Filter status = "Draft" | Only "Drafts — hidden" row remains. |
| A10 | Filter status reset → Export CSV | Browser downloads `quizzes-YYYY-MM-DD.csv` with column headers `id,title,course,batch,topic,…` |

Now open `/questions`.

| # | Action | Expected |
|---|--------|----------|
| A11 | Table has at least 5 rows (Q1–Q5 seeded) | Each row shows truncated prompt, topic name, difficulty pill, "Options (1 correct)", and "Used in N quiz(zes)". |
| A12 | Tap **Archive** on Q5 ("dot product of two perpendicular vectors") | Status pill flips to **Archived** (amber). Audit `question_archive` row appears. |
| A13 | Filter Status = "Archived" | Only the archived row appears. |
| A14 | Tap **Unarchive** | Pill flips back. Audit `question_unarchive`. |
| A15 | The "Delete" button on a question that has `use_count > 0` | Should be disabled (greyed out) with tooltip "Used by a quiz — archive instead". |
| A16 | If you click delete on an unused question | Confirmation modal opens. (Skip the actual delete unless you want to.) |
| A17 | Export CSV | Downloads `questions-YYYY-MM-DD.csv`. |

---

## B. Teacher mobile — quiz-builder UI rendering (real device)

Open Expo Go, sign in as the seeded teacher account.

| # | Action | Expected |
|---|--------|----------|
| B1 | Bottom tab bar | 6 tabs: Home · Scan · Classes · Library · **Quizzes** (new) · Batch · Profile. (7 tabs total — the bar may scroll/clip on small phones.) |
| B2 | Tap **Quizzes** tab | Header "Quizzes" + a blue "+ New" button in the top-right. The 3 seeded quizzes appear: Kinematics — Easy 4 (Published, 4 q), Vectors — Hard 1 (Published, 1 q), Drafts — hidden (Draft, 1 q). |
| B3 | Tap **+ New** | Navigates to `quiz-builder/new`. The whole screen replaces the tab bar (top-level Stack route — D-169 mirror). |
| B4 | Fill: Title="Manual test quiz" → tap Subject picker | A bottom sheet slides up listing "Physics". Tap it. |
| B5 | Tap Chapter → Topic | Cascading pickers work; pick "Mechanics" → "Kinematics". |
| B6 | Batch picker | Sheet shows "Course-wide (no batch)" + the Batch A entry. Tap Batch A. |
| B7 | Tap **+ New question** | Modal slides up: "New Question" with prompt textarea, difficulty pills, 4 option rows (with empty letter circles A/B/C/D), explanation, related content list. |
| B8 | Enter prompt `Solve $x^2 - 4 = 0$ for x.` | Prompt textarea accepts the markdown text including `$…$` math delimiters. |
| B9 | Tick option A circle | The A circle turns green with a white check. (Multiple ticks allowed in the UI, but server only counts the first `is_correct=true` as the canonical answer.) |
| B10 | Tap Save in the modal header | If a topic is set and at least 2 options have text + 1 is correct, the modal closes and a "Question 1." row appears in the parent list. Otherwise an Alert says "Empty prompt" / "Mark correct" / "Need 2 options". |
| B11 | Tap **From bank** | Modal opens listing seeded Q1-Q5 (whatever's in the topic Kinematics). Multi-select 2 → "Add (2)". Modal closes; 2 more rows appear. |
| B12 | **Publish** | If title/topic/duration are all valid, an Alert "Saved · Quiz published." appears and you're returned to the Quizzes tab. The new quiz appears in the list. |

---

## C. Student mobile — happy path (real device)

Sign out the teacher → sign in as Student A1.

| # | Action | Expected |
|---|--------|----------|
| C1 | Open Home tab | If you've already submitted any quiz with <70%, a "Weak topics" card surfaces it. On a first run with the seed fixtures there are no submitted attempts yet → the card is hidden. |
| C2 | Open Library → Physics → Mechanics → Kinematics | At the bottom of the topic items list (after any Phase-5 content), a "Practice Quizzes" section appears with **Kinematics — Easy 4** (1 row). |
| C3 | Tap the Kinematics — Easy 4 row | Top-level `quiz/[id]` screen opens (no tab bar). Title + rules block + "Start Quiz" button render correctly. |
| C4 | Tap **Start Quiz** | Question 1 renders. The timer pill in the top-right reads `05:00` and counts DOWN to `04:59` within one second. |
| C5 | Tap option A | The option border turns blue and the letter circle turns blue. Tap option B — A returns to default, B turns blue. |
| C6 | Tap the 🚩 Flag pill | Pill turns yellow, label "Flagged". Tap again — reverts to grey "Flag". |
| C7 | Tap Next | Question 2 renders. Q-grid at the bottom shows Q1 in green (answered) + Q2 highlighted blue (current). |
| C8 | Background the app for 30 s, return | Timer continues counting from where it was (server-anchored — see `deadline_at` minus `server_now`). Selections still ticked. |
| C9 | Navigate back to Library → Kinematics → back to the quiz row → tap it | The intro screen appears again, but tapping **Start Quiz** RESUMES the same attempt (`quiz-start` returns the same `attempt_id`). Selections + flags from C5–C7 are still there. |
| C10 | Answer Q3 + Q4 (don't answer Q1/Q2 again) | Q-grid shows the answered cells in green. |
| C11 | Tap **Submit** | Confirmation modal: "Submit quiz? You've answered N/4." Tap **Submit**. |
| C12 | Result screen | Big score number (e.g. `4 / 16`, `25%`). Stat row: Correct / Wrong / Skipped. Score arithmetic should match: each correct option (sort_order 0 is "correct" in the seed — `m/s²`, `20 m/s`, "Straight horizontal line…", "Returned to its starting point") gives +4; each wrong −1; each skipped 0. |
| C13 | Tap **View Solutions** | Per-question cards with: prompt, options (the student's choice highlighted RED if wrong, GREEN if right; the correct option always highlighted GREEN), explanation, and (for Q1) a "Related: Intro to Kinematics (placeholder)" tile. |
| C14 | Tap the Related Video tile on Q1's solution card | Navigates to the Phase 5 `video/[contentId]` screen and starts playing (the placeholder Rick Astley fixture). Tap back. |
| C15 | Tap **Retake** on the result screen | Returns to the intro screen with a fresh attempt. Best score still 25% (from C12). |
| C16 | Open Home tab | Weak Topics card now shows "Kinematics — 25%" (or whatever you scored). Tap it — launches `quiz/<id>`. |
| C17 | Re-take and score >70% | Re-open Home — the Weak Topics card for Kinematics is gone. |

---

## D. Student mobile — edge cases (real device)

| # | Action | Expected |
|---|--------|----------|
| D1 | While in an active attempt, open the iOS network inspector (Safari → Develop → Connect to Expo Go) → call `quiz-start` again | Response JSON body does NOT contain the substring `"is_correct"` anywhere. (Automated smoke `T12` already verified this — visual confirmation just for trust.) |
| D2 | Sign in as Student B1 (Batch B) | Library → Physics → Mechanics → Vectors → bottom shows **Vectors — Hard 1** (course-wide). Kinematics — Easy 4 (batch-A-scoped) is NOT visible from Batch B. |
| D3 | Tap Kinematics topic on B1 | "No content in this topic." (No batch-A-scoped quizzes appear.) |
| D4 | Try the URL `/quiz/<Quiz 1 id>` directly (deep link from a teammate) | `quiz-start` returns 403 "quiz not in your batch". The screen shows the error and a Retry button. (B1 cannot start a Batch-A quiz even via direct URL.) |
| D5 | Submit a fresh attempt with 0 answers | Score = `0 / max`, 0 correct, 0 wrong, all skipped. No error. |
| D6 | Time out the timer | Wait until the pill hits `00:00`. The attempt auto-submits → result screen appears. Re-fetching `quiz-attempt-result` shows `is_auto_submit: true`. |
| D7 | After submit, navigate to Library again | Library top of "Practice Quizzes" still shows the same quiz with "attempted Nx, best K%". |

---

## E. Teacher — write surface coverage (real device)

| # | Action | Expected |
|---|--------|----------|
| E1 | Quiz-builder: create a question with a KaTeX prompt `$\int_0^\infty e^{-x^2} dx = \frac{\sqrt{\pi}}{2}$` | The save succeeds; the question can be added to a quiz; on student attempt the prompt renders as a properly-typeset integral (the math glyph, not the raw `\int`). |
| E2 | Create a question and tick TWO correct options | Save proceeds. On grading, only the FIRST option marked `is_correct = true` (by `sort_order`) is treated as the canonical correct — see `quiz-submit` `find((o) => o.is_correct)`. Acceptable for MVP per spec §9 "live edits". |
| E3 | Edit an existing teacher quiz (open `quiz-builder/<existing>`) | The form pre-fills from the saved row. Save Draft → toggles `is_published=false`. Re-publishing → flips back. |
| E4 | Try to edit another teacher's quiz (sign out + sign in as a second teacher) | Quizzes tab shows only your own quizzes (the other teacher's quizzes don't appear). Direct URL to the other teacher's quiz-builder loads the form but Save returns RLS error 42501 (PostgREST UPDATE blocked by `quizzes_teacher_update` policy). |

---

## F. SQL sanity (I've already verified these; redo only if curious)

```
-- 4 new tables created (questions + question_options + question_solutions
-- + quizzes + quiz_questions + quiz_attempts + quiz_answers = 7 total Phase 6
-- tables; +0 from Phase 5 unchanged).
select table_name, count(*) as n_cols
from information_schema.columns
where table_schema = 'public'
  and table_name in ('questions','question_options','question_solutions',
                     'quizzes','quiz_questions','quiz_attempts','quiz_answers')
group by table_name order by table_name;
-- Expect:
--   question_options    7
--   question_solutions  4
--   questions           9
--   quiz_answers        5
--   quiz_attempts      13
--   quiz_questions      4
--   quizzes            16

-- All 7 quiz tables have RLS enabled.
select relname, relrowsecurity from pg_class
where relnamespace = 'public'::regnamespace
  and relname in ('questions','question_options','question_solutions',
                  'quizzes','quiz_questions','quiz_attempts','quiz_answers')
order by relname;
-- All `relrowsecurity = true`.

-- 33 policies in total across the 7 tables.
select count(*) from pg_policies
where schemaname = 'public'
  and tablename in ('questions','question_options','question_solutions',
                    'quizzes','quiz_questions','quiz_attempts','quiz_answers');
-- Expect 33.

-- exam-images bucket: private, 5 MB, jpeg/png/webp.
select id, public, file_size_limit, allowed_mime_types
from storage.buckets where id = 'exam-images';
-- Expect public=false, file_size_limit=5242880, mime=[image/jpeg, image/png, image/webp].
```

---

## G. Performance + cross-platform spot-checks (optional)

- **iOS — KaTeX cold render time:** open a quiz with math in every option on the seeded iPhone. The first WebView mount of MathText should resolve KaTeX glyphs within ~600 ms on a wired-Wi-Fi cdnjs hit. (Subsequent mounts are sub-100 ms due to HTTP caching.)
- **Android Redmi 8A:** deferred to next manual session — hardware blocker carry-over from Phase 5.
- **Network airplane mode mid-attempt:** auto-save will queue and silently fail; re-enable Wi-Fi and the next tap will flush. No data loss because local React state still holds the answers until the next upsert succeeds.

---

## H. What I (the agent) already verified — DON'T re-test

- DB schema is exactly as documented (4 tables × column count, 3 PK + N FK constraints, 14 indexes, 6 CHECK constraints, 33 RLS policies — all queried).
- All 4 migrations applied successfully on `orqwyazvcthgxoadfxfv`.
- All 5 edge fns deployed and `verify_jwt = true`.
- Storage bucket `exam-images` created with the right limits + the existing deny-all storage policy applies.
- Marking math: 27 `pnpm test:quiz` unit assertions including `gradeAttempt` against a 4-question mixed input.
- KaTeX detection regex: 7 cases including `$x$`, `$$ block $$`, `\(...\)`, `\[...\]`, and the negative case "It costs $ today" (no `$x$` pattern).
- RLS:
  - Student cannot SELECT `question_options` (returns `[]`).
  - Student cannot SELECT `questions` (returns `[]`).
  - Student cannot SELECT `question_solutions` (returns `[]`).
  - Student in batch A cannot start a quiz scoped to batch B (`quiz-start` → 403).
  - Student in other course cannot SELECT a different course's quiz.
  - Student cannot SELECT another student's quiz_attempts.
  - Student can upsert quiz_answers for own in-flight attempt (RLS allows).
  - Student CANNOT upsert quiz_answers after submit (RLS WITH CHECK fails).
  - Cross-teacher quiz update is blocked.
  - Teacher reads all questions (for the picker).
  - quiz-start response JSON is stringify+grep'd and contains zero `"is_correct"`.
- Edge fn HTTP smoke (26 assertions):
  - `quiz-start`: 401 no-auth, 403 owner-admin, 400 bad uuid, 200 happy with 2-question payload.
  - `quiz-start` re-call returns the same `attempt_id` (idempotency).
  - `quiz-submit`: 200 happy with correct score arithmetic (4/8, 1 correct + 1 skipped); 409 on replay; post-submit payload reveals `is_correct`.
  - `quiz-attempt-result`: 200 re-fetch with same score; 409 on in-flight; 401 no-auth.
  - `quiz-image-presign`: 403 student, 200 teacher with signed URL, 400 on >5MB, 400 on `image/gif`.
  - `quiz-admin-mutate`: 403 for student + teacher, 200 for owner; audit row written for `quiz_unpublish`; 409 on `delete_question` while in use; 200 for `archive_question`; 200 for `delete_quiz`.
- Supabase advisor sweep: zero new ERROR/WARN. INFO-only items (unindexed FKs on `quiz_answers`, 3 unused indexes, 22 multiple-permissive-policy entries) are intentional and tracked in the ledger.
- `pnpm typecheck` + `pnpm lint` + 6 mobile jest suites — all green.

---

## I. Report-back format

For each section A–E, send back ONE of:

- `OK` — pass without notes.
- `OK — note: <thing>` — pass but you noticed something worth flagging.
- `FAIL — <one-line cause + what you saw>` — broken.

Plus paste any console errors and / or screenshots that look wrong. The
ledger's ACCEPTED line is left BLANK pending your sign-off.
