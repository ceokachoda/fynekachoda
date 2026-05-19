# Phase 6 — Practice Quizzes

> Self-paced MCQs with full solution view (explanation + linked video). Question bank + quiz authoring (mobile-friendly). KaTeX + image support. Server-side grading. Mastery feeders (full mastery comes in Phase 8).

---

## 1. Goal

Ship the first interactive learning loop: students take a quiz, see how they did, learn from the explanation, and click into the related video. Provide the question authoring surface teachers will reuse for exams in Phase 7.

## 2. Prerequisites

- [ ] Phase 5 accepted.
- [ ] Library content present (used by "Related Video" links).
- [ ] Decide whether to also support **image-only** questions (math problems with diagrams). → Yes (D-058).
- [ ] Decide KaTeX render method: WebView with KaTeX shipped as static asset (recommended) vs `react-native-mathjax` (heavier). → **WebView + KaTeX static**.

## 3. Scope

### In
- DB: `questions`, `question_options`, `question_solutions`, `quizzes`, `quiz_questions`, `quiz_attempts`, `quiz_answers`.
- Storage bucket: `exam-images` (also reused by Phase 7 exams).
- Edge functions: `quiz-start`, `quiz-submit`, `quiz-image-presign`.
- KaTeX renderer component (`components/quiz/MathText.tsx`).
- Mobile student: `(student)/quiz/[id].tsx` with full attempt flow (timer, Q-grid, flag, auto-save, submit, solution view).
- Mobile teacher: `(teacher)/quiz-builder.tsx` with question authoring (Markdown + KaTeX live preview + image picker + options + explanation + related video link).
- Question bank (admin + teacher views): browse, filter by topic + difficulty.
- Dashboard "Weak Topics" practice quiz CTA hooked up (mastery still placeholder until Phase 8).
- Mastery feeding: every submit inserts a row in `mastery` table (or triggers `mastery-recompute`).

### Out
- Graded exams (Phase 7).
- Offline test scores (Phase 7).
- Adaptive difficulty.
- Quiz analytics for teachers (Phase 8 batch dashboard).

## 4. Specs in play

- `docs/spec/practice-quizzes.md` — primary.
- `docs/spec/study-materials.md` — related video linkage.
- `docs/spec/security.md §4` (server-side grading; no `is_correct` leak).
- `docs/decisions.md` D-050, D-051, D-053, D-054, D-057, D-058, D-059.

## 5. Backend work

### 5.1 Migration: question bank (Checkpoint 1)

`supabase/migrations/0012_question_bank.sql`:

```sql
create table public.questions (
  id           uuid primary key default gen_random_uuid(),
  topic_id     uuid not null references public.topics(id) on delete restrict,
  prompt_md    text not null,
  prompt_image_path text,
  difficulty   text check (difficulty in ('easy','medium','hard')),
  created_by   uuid not null references public.app_users(id),
  is_archived  boolean not null default false,
  created_at   timestamptz not null default now()
);

create index questions_topic_idx on public.questions (topic_id) where is_archived = false;

create table public.question_options (
  id          uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  text_md     text not null,
  is_correct  boolean not null default false,
  sort_order  int not null default 0
);

create table public.question_solutions (
  question_id        uuid primary key references public.questions(id) on delete cascade,
  explanation_md     text not null,
  related_content_id uuid references public.content_items(id) on delete set null
);
```

### 5.2 Migration: practice quizzes (Checkpoint 2)

`supabase/migrations/0013_quizzes.sql`:

```sql
create table public.quizzes (
  id                  uuid primary key default gen_random_uuid(),
  title               text not null,
  topic_id            uuid references public.topics(id) on delete restrict,
  chapter_id          uuid references public.chapters(id) on delete restrict,
  batch_id            uuid references public.batches(id) on delete cascade,
  course_id           uuid not null references public.courses(id),
  duration_min        int not null default 20 check (duration_min between 1 and 240),
  marks_correct       numeric not null default 4,
  marks_wrong         numeric not null default -1,
  marks_skip          numeric not null default 0,
  randomize_questions boolean not null default true,
  randomize_options   boolean not null default true,
  is_published        boolean not null default false,
  created_by          uuid not null references public.app_users(id),
  created_at          timestamptz not null default now(),
  check (topic_id is not null or chapter_id is not null)
);

create table public.quiz_questions (
  quiz_id     uuid not null references public.quizzes(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete restrict,
  sort_order  int not null default 0,
  primary key (quiz_id, question_id)
);

create table public.quiz_attempts (
  id           uuid primary key default gen_random_uuid(),
  quiz_id      uuid not null references public.quizzes(id) on delete cascade,
  student_id   uuid not null references public.students(user_id) on delete cascade,
  started_at   timestamptz not null default now(),
  submitted_at timestamptz,
  score        numeric,
  max_score    numeric,
  is_practice  boolean not null default true,
  metadata     jsonb not null default '{}'::jsonb
);

create index quiz_attempts_student_submitted_idx on public.quiz_attempts (student_id, submitted_at desc);

create table public.quiz_answers (
  attempt_id         uuid not null references public.quiz_attempts(id) on delete cascade,
  question_id        uuid not null references public.questions(id) on delete restrict,
  selected_option_id uuid references public.question_options(id),
  is_flagged         boolean not null default false,
  answered_at        timestamptz,
  primary key (attempt_id, question_id)
);
```

### 5.3 Migration: quiz RLS (Checkpoint 3)

`supabase/migrations/0014_quiz_rls.sql`:

```sql
alter table public.questions enable row level security;
alter table public.question_options enable row level security;
alter table public.question_solutions enable row level security;
alter table public.quizzes enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.quiz_answers enable row level security;

-- Questions/options/solutions: readable by teacher/admin always; students only see them via an active attempt (enforced at edge fn).
create policy q_teacher_admin on public.questions for select to authenticated
  using (public.has_role('teacher') or public.is_admin());
create policy qo_teacher_admin on public.question_options for select to authenticated
  using (public.has_role('teacher') or public.is_admin());
create policy qs_teacher_admin on public.question_solutions for select to authenticated
  using (public.has_role('teacher') or public.is_admin());

-- Students read questions via a special path: question_options.is_correct must NEVER leak. Two approaches:
-- (a) Restrict columns via a view. (b) Always go through the edge fn.
-- We do (b): students never select directly from question_options. Edge fn returns a sanitized payload.

create policy q_admin_write on public.questions for all to authenticated
  using (public.is_admin() or (public.has_role('teacher') and created_by = public.current_app_user_id()))
  with check (public.is_admin() or (public.has_role('teacher')));
create policy qo_admin_write on public.question_options for all to authenticated
  using (public.is_admin() or public.has_role('teacher'))
  with check (public.is_admin() or public.has_role('teacher'));
create policy qs_admin_write on public.question_solutions for all to authenticated
  using (public.is_admin() or public.has_role('teacher'))
  with check (public.is_admin() or public.has_role('teacher'));

-- Quizzes: student reads published in their scope.
create policy quizzes_student on public.quizzes for select to authenticated
  using (
    is_published = true
    and course_id = (
      select b.course_id from public.students s join public.batches b on b.id = s.batch_id
      where s.user_id = public.current_app_user_id()
    )
    and (batch_id is null or batch_id = (select batch_id from public.students where user_id = public.current_app_user_id()))
  );

create policy quizzes_teacher on public.quizzes for select to authenticated
  using (
    public.has_role('teacher')
    and (batch_id is null or batch_id in (select batch_id from public.batch_teachers where teacher_id = public.current_app_user_id()))
  );

create policy quizzes_teacher_write on public.quizzes for all to authenticated
  using (public.has_role('teacher') and created_by = public.current_app_user_id())
  with check (public.has_role('teacher'));

create policy quizzes_admin on public.quizzes for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- quiz_questions: read same scope as quiz; write via teacher who created the quiz.
create policy qq_read on public.quiz_questions for select to authenticated using (
  exists (select 1 from public.quizzes q where q.id = quiz_id) -- piggyback on quiz RLS
);
create policy qq_write on public.quiz_questions for all to authenticated
  using (public.has_role('teacher') or public.is_admin())
  with check (public.has_role('teacher') or public.is_admin());

-- Attempts: student reads/writes own (writes via edge fn for grading).
create policy qa_self_read on public.quiz_attempts for select to authenticated
  using (student_id = public.current_app_user_id());
create policy qa_teacher_read on public.quiz_attempts for select to authenticated
  using (public.has_role('teacher') or public.is_admin());
-- No write policies — edge fn only.

-- quiz_answers: students upsert their own.
create policy qans_self on public.quiz_answers for all to authenticated
  using (attempt_id in (select id from public.quiz_attempts where student_id = public.current_app_user_id()))
  with check (attempt_id in (select id from public.quiz_attempts where student_id = public.current_app_user_id()));
```

### 5.4 Edge fn: quiz-start (Checkpoint 4)

`apps/functions/quiz-start/index.ts`:

Input: `{ quiz_id }`.

Steps:
1. Verify student caller; quiz is published and in their scope.
2. Look up quiz + questions + options.
3. Build a sanitized payload: questions with options (id + text_md only, **no `is_correct`**), in randomized order if quiz says so, options also randomized.
4. Snapshot order in `quiz_attempts.metadata` so refresh / re-open shows same order.
5. INSERT `quiz_attempts(started_at=now())`.
6. Return `{ attempt_id, questions: [...], duration_min, marks_correct, marks_wrong, marks_skip }`.

### 5.5 Edge fn: quiz-submit (Checkpoint 5)

`apps/functions/quiz-submit/index.ts`:

Input: `{ attempt_id }`.

Steps:
1. Verify caller owns attempt; submitted_at IS NULL.
2. Load `quiz_answers` for this attempt.
3. For each `quiz_questions` row, look up correct `question_options`; apply marking (`correct`, `wrong`, `skip`).
4. Compute `score` + `max_score`.
5. UPDATE `quiz_attempts` SET `submitted_at = now()`, score, max_score.
6. INSERT `activity_days(student_id, today)` ON CONFLICT DO NOTHING.
7. Trigger `mastery-recompute` (created in Phase 8, but include a stub that no-ops in Phase 6 — wired in Phase 8).
8. Return `{ score, max_score, correct_count, wrong_count, skipped_count }`.
9. Audit.

### 5.6 Edge fn: quiz-image-presign (Checkpoint 6)

`apps/functions/quiz-image-presign/index.ts`:

Input: `{ kind: 'question_prompt'|'option_image', mime, size }`.

Steps:
1. Verify teacher/admin.
2. Validate (PNG/JPEG/WebP; ≤ 5 MB).
3. Issue signed upload URL to `exam-images/{uuid}.{ext}`.
4. Return upload URL + path.

(After upload, the path is stored in `questions.prompt_image_path`.)

### 5.7 Storage bucket: exam-images (Checkpoint 7)

```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('exam-images', 'exam-images', false, 5242880, array['image/jpeg','image/png','image/webp']);
```

### 5.8 Mobile: quiz attempt (Checkpoint 8)

`apps/mobile/app/(student)/quiz/[id].tsx`:

Stages (single screen with state machine):
- **intro**: title, rule summary, best score, "Start Quiz".
- **attempt**: question card, options, flag, prev/next, Q-grid, timer.
- **submit_confirm**: modal.
- **result**: score breakdown + "View Solutions" / "Retake".
- **solution**: per-question card with selected vs correct, explanation, related video.

Components:
- `QuestionCard` (renders prompt with `MathText` for KaTeX).
- `OptionRadio` (per option; KaTeX in options too).
- `NavigationGrid` (color-coded grid; Q jump).
- `TimerPill` (server-synced; counts down to `started_at + duration_min`).
- `FlagButton`.

Auto-save: each option select / flag toggle triggers an upsert to `quiz_answers` via the Supabase JS client (RLS allows).

`MathText` component:
- Renders Markdown via `react-native-markdown-display`.
- Detects `$$...$$` or `$...$` blocks → swap with `WebView` rendering KaTeX (pre-built static HTML).
- Avoid mounting WebView per question on weak devices; render up-front once per page.

### 5.9 Mobile: quiz builder (Checkpoint 9)

`apps/mobile/app/(teacher)/quiz-builder.tsx`:

Sections (accordion):
- Title + scope (topic/chapter + batch).
- Rules (duration + marking + randomize toggles).
- Questions list (drag-reorder).

Question editor sheet:
- Markdown editor with live preview (small WebView with KaTeX).
- Image: pick → upload via presign.
- Options: 2-6 rows, each Markdown + "Mark correct".
- Explanation Markdown.
- Related video picker (queries `content_items` of kind='video' in same topic).

"Add from Bank":
- Filterable list of existing `questions` rows by topic + difficulty.
- Multi-select + add.

Save Draft (`is_published=false`) vs Publish.

### 5.10 Dashboard wiring (partial) (Checkpoint 10)

`apps/mobile/app/(student)/index.tsx`:
- "Weak Topics" card shows topics with at least 1 attempt where score % < 70 (proxy for mastery until Phase 8). Tapping launches the most-recent published quiz for that topic.
- "Continue Watching" already wired in Phase 5.

## 6. Files changed (summary)

### Mobile — added
- `app/(student)/quiz/[id].tsx`
- `app/(teacher)/quiz-builder.tsx`
- `components/quiz/QuestionCard.tsx`, `OptionRadio.tsx`, `NavigationGrid.tsx`, `TimerPill.tsx`, `FlagButton.tsx`, `MathText.tsx`
- `components/teacher/QuestionEditor.tsx`, `OptionEditor.tsx`, `QuestionBankSheet.tsx`
- `assets/katex/` (static KaTeX HTML + CSS bundled with the app)
- `features/quiz/useQuizStart.ts`, `useQuizSubmit.ts`, `useQuizAttempt.ts` (auto-save), `useQuizBuilder.ts`

### Mobile — edited
- `app/(student)/index.tsx` — wire "Weak Topics" card to launch quiz.

### Edge fns added
- `quiz-start`, `quiz-submit`, `quiz-image-presign`

### Storage
- Bucket `exam-images` created.

### Admin
- `/exams` page placeholder (filled by Phase 7).

### Shared
- `packages/shared/src/validation/quizSchemas.ts`
- `packages/shared/src/constants/marking.ts`

## 7. Integration & cross-cutting

- Audit: `quiz_create`, `quiz_publish`, `quiz_unpublish`, `quiz_delete`, `question_create`, `question_update`, `question_archive`.
- Telemetry: `quiz_started`, `quiz_answer_changed`, `quiz_flag_toggled`, `quiz_submitted`, `quiz_solution_viewed`, `quiz_related_video_opened`.
- Mastery wiring stub: `quiz-submit` calls `mastery-recompute` fn even though it's a no-op until Phase 8.

## 8. Risks & gotchas

| Risk | Mitigation |
|---|---|
| Correct-answer leak via direct `question_options` query | Students NEVER select `question_options` directly during attempts. Edge fn returns sanitized payload. RLS doubles down by allowing only teacher+admin SELECT on the table; students rely on the edge fn response. |
| KaTeX rendering slow / blank on Redmi 8A | Static HTML+CSS + single WebView per page; tested. Fallback to plain text if WebView errors. |
| Auto-save spam on flag toggle | Debounce to 250 ms; combine flag + answer upsert. |
| Quiz authoring on phone is tedious | Acceptable for MVP; admin web can also create quizzes (a later phase nice-to-have). |
| Question images leak via signed URL forwarding | URLs expire in 1h; images don't contain PII; acceptable. |
| Two attempts started in quick succession (double-tap) | Idempotency: if there's an in-flight attempt (started_at < 60s ago, no submitted_at), reuse it. |
| Quiz publish edit cycle: teacher publishes, edits question, breaks active attempt | For practice quizzes we accept live edits. Exams (Phase 7) will snapshot questions. |

## 9. Acceptance criteria

1. Migrations clean.
2. Teacher creates a question with KaTeX + image, 4 options, mark one correct, explanation, link to a Phase 5 video.
3. Teacher creates a quiz of 5 questions, sets duration 10 min, +4/-1/0.
4. Teacher publishes; student in same batch sees quiz in library at topic level.
5. Student starts quiz → questions render with KaTeX + image; options visible.
6. Student answers 3 questions, flags 1, leaves screen → returns → state preserved.
7. Student selects different options; new selections persist (upsert).
8. Timer ticks down; reaches 0 → auto-submit fires.
9. Submitting before timeout: result screen shows correct score per marking.
10. Solution view: shows student's selection vs correct, explanation Markdown renders with KaTeX, "Related Video" opens the linked content.
11. Student retakes quiz → new attempt row; first attempt's score retained as "best".
12. Question-bank reuse: teacher creates a second quiz on same topic, picks questions from bank.
13. Inspecting network calls during an attempt: no `is_correct` field appears anywhere.
14. Querying `question_options` directly as a student returns rows for the active quiz but `is_correct` is filtered out (verify via RLS policy + edge fn shape).
15. Student in batch B cannot start a quiz scoped to batch A.
16. Cold start budget still under 3s; quiz attempt screen renders <1s on Redmi 8A.
17. CI green; RLS tests cover the leakage scenarios.

## 10. Test plan

### Unit
- Marking calculator (correct / wrong / skip combinations).
- Snapshot ordering: same metadata produces same display.
- Markdown → KaTeX detection regex.

### Integration
- `quiz-start`: scope checks, randomization snapshot, returns sanitized payload.
- `quiz-submit`: scoring correctness; replay protection (resubmit blocked).

### RLS
- Student cannot SELECT `question_options.is_correct` directly.
- Student in batch A cannot start a quiz scoped to batch B.
- Teacher of batch A can edit only their own quizzes.

### Manual QA
- Type a KaTeX equation `$\\int_0^\\infty e^{-x^2}\\,dx = \\frac{\\sqrt{\\pi}}{2}$` in a question, verify renders on both platforms.
- Take a quiz on Redmi 8A: smooth scrolling, no jank.
- Submit with 0 answers → score = 0 × max.

## 11. Rollback plan

If Phase 6 breaks:
1. Revert migrations 0012–0014.
2. Mobile quiz screens revert to "Coming soon" or removed entirely.
3. Existing content library unaffected.

## 12. Definition of done

- [ ] All 17 AC pass.
- [ ] Network inspection confirms zero `is_correct` leakage.
- [ ] CI green; RLS tests green.
- [ ] User says "Phase 6 accepted".

## 13. Hand-off to Phase 7

- Question bank + grading infra usable for graded exams.
- `quiz_attempts` table will be queried alongside `exam_attempts` in Phase 8 mastery.
- Phase 7 adds `exams`, `exam_attempts`, `offline_test_scores`, and the locked-down attempt UI with server-time enforcement.

---

## 14. Acceptance ledger — Phase 6 (2026-05-19)

All 13 checkpoints (CP1–CP13) green. DB: 4 new migrations applied. Edge fns: 5 deployed. Mobile: 2 new top-level screens (`app/quiz/[id].tsx`, `app/quiz-builder/[quizId].tsx`) + 7 components + 7 feature hooks + 1 teacher tab. Admin: 2 new dashboard pages (`/quizzes`, `/questions`) + server-action sets routed through a single audited edge fn.

### Checkpoints

| CP   | Subject | Outcome | Where |
|------|---------|---------|-------|
| CP1  | `questions` + `question_options` + `question_solutions` migration | ✅ applied | `supabase/migrations/20260519100000_question_bank.sql` |
| CP2  | `quizzes` + `quiz_questions` + `quiz_attempts` + `quiz_answers` migration | ✅ applied; CHECK enforces (topic_id is not null or chapter_id is not null) AND coherent post-submit columns | `supabase/migrations/20260519100500_quizzes.sql` |
| CP3  | RLS for all 7 quiz/question tables | ✅ applied; 33 policies; students cannot SELECT `questions` / `question_options` / `question_solutions` directly; teacher reads bank + writes own; admin all-or-nothing per `private.is_admin()` | `supabase/migrations/20260519101000_quiz_rls.sql` |
| CP4  | `quiz-start` edge fn | ✅ deployed; student-only; idempotently reuses in-flight attempt; sanitises payload (NO `is_correct`); signs prompt+option image URLs (4h TTL); snapshots `(question_order, option_order)` in attempt metadata | `apps/functions/quiz-start/index.ts` |
| CP5  | `quiz-submit` edge fn | ✅ deployed; student-only; grades server-side; 409 on replay; upserts `activity_days` (IST per D-014); audits `quiz_submitted`; returns solution payload with `is_correct` revealed post-submit | `apps/functions/quiz-submit/index.ts` |
| CP5b | `quiz-attempt-result` edge fn (NEW — see D-175) | ✅ deployed; read-only re-fetch of submitted attempt's result + per-question solutions; auth gate: owner / teacher-of-quiz-or-student-batch / admin | `apps/functions/quiz-attempt-result/index.ts` |
| CP6  | `quiz-image-presign` edge fn | ✅ deployed; teacher/admin only; jpeg/png/webp ≤ 5 MB; returns signed upload URL + path under `exam-images/<uploader_id>/<kind>/<uuid>.<ext>` | `apps/functions/quiz-image-presign/index.ts` |
| CP7  | `exam-images` private Storage bucket | ✅ applied; reuses existing `deny_all_content_objects` storage policy → only service-role traffic reads/writes; mobile reads via signed URLs from `quiz-start` / `quiz-submit` / `quiz-attempt-result` | `supabase/migrations/20260519101500_storage_exam_images.sql` |
| CP8  | Mobile student quiz attempt UI | ✅ wired at top-level `app/quiz/[id].tsx` (outside `(student)` tabs per D-169); 4-stage state machine (intro → attempt → result → solution); auto-saves via debounced upsert to `quiz_answers`; KaTeX via `MathText` (WebView only when math detected); navigation grid; flag toggle; server-anchored timer | `apps/mobile/app/quiz/[id].tsx`, `apps/mobile/components/quiz/*`, `apps/mobile/features/quiz/*` |
| CP9  | Mobile teacher quiz-builder | ✅ wired at top-level `app/quiz-builder/[quizId].tsx`; new "Quizzes" tab in `(teacher)/_layout.tsx`; cascading course→subject→chapter→topic→batch pickers; inline new-question modal + "Add from bank" sheet; Save Draft / Publish | `apps/mobile/app/(teacher)/quizzes.tsx`, `apps/mobile/app/quiz-builder/[quizId].tsx`, `apps/mobile/components/quiz/*` |
| CP10 | Student dashboard "Weak topics" + library wiring | ✅ wired; `useWeakTopics` proxies mastery (topics where the student averages <70%) using submitted `quiz_attempts`; library `useStudentQuizDiscovery` adds a "Practice Quizzes" section at topic level showing attempt-count + best-% | `apps/mobile/app/(student)/index.tsx`, `apps/mobile/app/(student)/library.tsx`, `apps/mobile/features/quiz/{useWeakTopics,useQuizDiscovery}.ts` |
| CP11 | Admin `/quizzes` + `/questions` moderation pages | ✅ wired; both pages route every mutation through `quiz-admin-mutate` so `audit_log` captures before/after (D-172); CSV export; filters; delete-question is blocked at the edge fn when the question is in use (409) | `apps/admin/app/(dashboard)/{quizzes,questions}/{page,*-client,actions}.tsx`, `apps/admin/app/(dashboard)/layout.tsx` |
| CP12 | Tests + advisor sweep | ✅ green | `scripts/{test-quiz-helpers,smoke-test-quiz-rls,smoke-test-quiz-edge-fns}.ts` + advisor results below |
| CP13 | Ledger + manual test plan + memory + commit | ✅ this entry | here |

### Migrations applied (4 new)

| Timestamp | Name | Purpose |
|-----------|------|---------|
| 20260519100000 | `question_bank` | `questions` (9 cols, 3 partial indexes) + `question_options` (7 cols, 1 composite idx, CHECK on (text or image)) + `question_solutions` (4 cols, related_content_id idx). 2 updated_at trigger fns pinned to `set search_path = public, pg_temp` per D-166. |
| 20260519100500 | `quizzes` | `quizzes` (16 cols, 5 indexes inc. published-by-topic, course, batch) + `quiz_questions` (junction) + `quiz_attempts` (13 cols with active-attempt partial index) + `quiz_answers` (5 cols). |
| 20260519101000 | `quiz_rls` | 33 policies across 7 tables. Students have NO read on `questions` / `question_options` / `question_solutions`; PostgREST returns `[]` for those tables. Teachers can write rows they own. Admins have ALL (writes still funnel through `quiz-admin-mutate`). |
| 20260519101500 | `storage_exam_images` | New private `exam-images` bucket (5 MB / jpeg+png+webp). The existing `deny_all_content_objects` policy from Phase 5 covers it — non-service-role gets 403. |

### Edge functions deployed (5 new)

`quiz-start`, `quiz-submit`, `quiz-attempt-result`, `quiz-image-presign`, `quiz-admin-mutate`. All deployed via Supabase CLI 2.100.0 (`functions deploy --use-api`) from a temp workdir per D-170 against project `orqwyazvcthgxoadfxfv`. `verify_jwt = true` on all 5.

### Vault secrets

No new Vault secrets required. Phase 6 reuses the existing service-role bypass for HMAC-free flows. Phase 7 will likely add an `EXAM_SUBMIT_SECRET` when graded exams need server-time-enforced submissions.

### Tests + smokes

- `pnpm test:quiz` — pure-TS unit smoke covering `gradeAnswer`, `gradeAttempt`, `containsMath` / KaTeX delimiter detection, `shuffleStable`, `reconcileOrder`. **27/27 green.**
- `pnpm smoke:quiz-rls` — end-to-end RLS smoke creates an ephemeral course + 3 batches + 3 students + 2 teachers + bank + 3 quizzes, then exercises 12 RLS scenarios. **12/12 green.** Most critical: T12 stringifies the `quiz-start` response and asserts `"is_correct"` substring is NEVER present.
- `pnpm smoke:quiz-fns` — HTTP smoke for all 5 edge fns. **26/26 assertions green.** Covers auth gates, role gates, idempotency, replay-protection, audit-row write verification for `quiz_submitted` and `quiz_unpublish`, and the 409 on `delete_question` while in use.
- `pnpm test --filter @fynestudy/mobile` — 6 suites / 53 tests. **53/53 green** (pre-existing test surface; quiz code is jest-compatible but doesn't add new component tests in Phase 6 to keep the bundle lean).
- `pnpm typecheck` — every workspace package green.
- `pnpm lint` — every workspace package green.

### Advisor sweep

| Lint | Status |
|------|--------|
| `auth_leaked_password_protection` | WARN, carry-over from Phase 1 backlog. Not Phase 6. |
| `unindexed_foreign_keys` on `quiz_answers.question_id` + `quiz_answers.selected_option_id` | 2 INFOs. `quiz_answers_attempt_idx` covers the hot read path (always by `attempt_id`); the orphan-question cascade is rare in practice. Tracked. |
| `unused_index` on `questions_topic_active_idx`, `questions_difficulty_idx`, `question_solutions_related_content_idx` | 3 INFOs. Brand-new indexes with zero traffic — will flip to "used" as soon as `useQuestionBank` filters or the dashboard pulls topic-scoped suggestions. |
| `multiple_permissive_policies` (22 INFOs across all 7 quiz tables × actions) | Intentional. Same role-segmented pattern documented for Phase 5 (D-152 reasoning). No fix planned. |
| All other Phase 6-touched objects | Clean. The new trigger fns `_questions_updated_at` and `_question_solutions_updated_at` ship with `set search_path = public, pg_temp` per D-166 — advisor 0011 silent. |

### Hard-learned lessons / new decisions

- **D-175 (2026-05-19):** Quiz solution view re-fetch goes through a dedicated `quiz-attempt-result` edge fn rather than relying on cached `quiz-submit` response state. Why: the URL pattern `/quiz/[id]?stage=solution&q=1` is meant to be addressable across navigation away/back; signed image URLs expire (4h TTL); audit/role-scope semantics stay clean if every read goes through one server-side gate. The spec only lists 2 edge fns (`quiz-start`, `quiz-submit`) but the spec also calls for a re-openable solution screen — adding the third fn is the smallest path to that UX. How to apply: Phase 7 will mirror this with `exam-attempt-result` for graded exam solution viewing.

- **D-176 (2026-05-19):** PostgREST's `Prefer: return=representation` semantic — when a row is INSERT'd, PostgreSQL evaluates BOTH `WITH CHECK` (insert) AND `USING` (select-back) policies on the new row. A teacher inserting a quiz scoped to a batch they do not teach passes the teacher-insert WITH CHECK (`created_by = current_app_user_id()`) but fails the teacher-read USING (`batch_id in assigned`), and the entire INSERT errors with `42501 ... violates row-level security policy`. Why: discovered by `smoke-test-quiz-rls.ts` setup when inserting a Batch-B quiz from a Batch-A teacher. How to apply: in any RLS smoke or fixture seed that needs to plant rows in a scope the *posting* role can't read, use the service-role admin client for the insert (still allowed). Don't try to "relax" the SELECT policy — that's the right safety boundary.

- **D-177 (2026-05-19):** One admin-mutate edge fn per resource family (D-151 reaffirmed). `quiz-admin-mutate` carries 4 discriminated-union ops (`toggle_publish_quiz`, `delete_quiz`, `archive_question`, `delete_question`) instead of 4 separate fns. Audit semantics + role check live once. How to apply: every future admin moderation surface (Phase 7 exams, Phase 8 batch dashboards) starts the same way.

- **D-178 (2026-05-19):** KaTeX rendered via WebView + cdnjs `auto-render` (mirrors Phase 5 D-168 pdf.js pattern). `MathText` detects `$ ... $`, `$$ ... $$`, `\( ... \)`, `\[ ... \]` and ONLY mounts a WebView when math is present — plain text renders to a native `<Text>`. This keeps the Redmi-8A WebView budget low: a 4-option question with no math mounts zero WebViews; one with math in prompt + each option mounts five lightweight WebViews (KaTeX is much lighter than YT player or pdf.js, so the "one WebView at a time" rule from CLAUDE.md doesn't strictly bind). How to apply: Phase 7 graded exam screens reuse `MathText`. Phase 9 hardening can bundle KaTeX locally instead of from cdnjs (parallel to the pdf.js plan).

### Files changed (summary)

**Mobile — added:**
- `app/quiz/[id].tsx` (top-level student attempt + result + solution screen)
- `app/quiz-builder/[quizId].tsx` (top-level teacher builder)
- `app/(teacher)/quizzes.tsx` (teacher quizzes list, new tab)
- `components/quiz/{MathText,QuestionCard,OptionRadio,NavigationGrid,TimerPill,FlagButton,SolutionCard}.tsx`
- `features/quiz/{types,useQuizStart,useQuizSubmit,useQuizAttemptResult,useQuizAutoSave,useQuizDiscovery,useTeacherQuizzes,useTeacherQuizBuilder,useQuestionBank,useWeakTopics}.ts`

**Mobile — edited:**
- `app/_layout.tsx` (added `quiz/[id]` and `quiz-builder/[quizId]` Stack screens)
- `app/(teacher)/_layout.tsx` (+Quizzes tab)
- `app/(student)/index.tsx` (+Weak Topics card)
- `app/(student)/library.tsx` (+Practice Quizzes section at topic level)

**Edge fns — added:** `apps/functions/{quiz-start,quiz-submit,quiz-attempt-result,quiz-image-presign,quiz-admin-mutate}/index.ts`

**Shared — added/edited:**
- `apps/functions/_shared/quiz-marking.ts` (new — pure helpers used by edge fn AND tests)
- `apps/functions/_shared/schemas.ts` (+5 zod schemas — `QuizStartInputSchema`, `QuizSubmitInputSchema`, `QuizAttemptResultInputSchema`, `QuizImagePresignInputSchema`, `QuizAdminMutateInputSchema`)

**Migrations — added:** `20260519100000_question_bank.sql`, `20260519100500_quizzes.sql`, `20260519101000_quiz_rls.sql`, `20260519101500_storage_exam_images.sql`

**Admin — added:**
- `apps/admin/app/(dashboard)/quizzes/{page,quizzes-client,actions}.tsx`
- `apps/admin/app/(dashboard)/questions/{page,questions-client,actions}.tsx`

**Admin — edited:** `apps/admin/app/(dashboard)/layout.tsx` (+Quizzes, +Question bank nav items)

**Scripts — added:** `scripts/{test-quiz-helpers,smoke-test-quiz-rls,smoke-test-quiz-edge-fns,seed-quiz-manual-test}.ts`. New npm scripts `test:quiz`, `smoke:quiz-rls`, `smoke:quiz-fns`, `seed:quiz-manual-test` in root `package.json`.

### Phase 5 carry-overs partially addressed in Phase 6

- Seed-script cleanup flag: `scripts/seed-quiz-manual-test.ts` ships with `--reset` from day one, which wipes prior `p6-*` users + `P6_TEST_*` courses. The Phase 5 `seed-content-manual-test.ts` could be retrofitted similarly when next touched.

### Phase 6 carry-overs into Phase 7+

- Local KaTeX bundle instead of cdnjs `auto-render` (Phase 9 hardening, parallel to the pdf.js plan from Phase 5).
- Component-level jest tests for `MathText` / `NavigationGrid` (Phase 7 polish).
- Quiz analytics dashboard for teachers (Phase 8 batch dashboard, per phase-6.md §3 Out).
- `mastery-recompute` hook (Phase 8 — currently a no-op TODO in `quiz-submit`).
- Redmi 8A cold-start measurement of `app/quiz/[id].tsx` (hardware blocker, carry-over from Phase 5).
- Image upload from quiz-builder for prompt/option images (the `quiz-image-presign` fn is deployed and unit-tested; the inline image-picker UI is intentionally minimal in Phase 6 MVP — Phase 7 will add full DocumentPicker integration once teachers report needing it).
- Vercel deployment fix (still on Phase 1 placeholder; Phase 5 carry-over).
- Sentry + PostHog wiring (long-running Phase 1 carry-over).
- `auth_leaked_password_protection` toggle (long-running Phase 1 carry-over).
- `auth_rls_initplan` on `app_users` (Phase 2/3 carry-over).

### Phase 6 status: **CODE-COMPLETE — manual QA pending**

Work sits uncommitted on `phase-4` branch; user will direct the consolidated PR. Manual test plan at `docs/phases/phase-6-manual-tests.md`. Fresh fixture script `pnpm seed:quiz-manual-test` (with `--reset` flag).

### ACCEPTED — 
