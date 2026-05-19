# Phase 7 — Manual Test Plan (Visual + Real-Device only)

> **Scope:** this doc covers ONLY what an automated test cannot do — real
> browser rendering, real device interactions, server-anchored timer UX,
> tab-switch banner visibility, and the visual no-`correct_option_id`-leak
> check via the network inspector. Every functional/data behaviour has
> already been auto-verified by me on this dev project
> (`orqwyazvcthgxoadfxfv`).
>
> **Already proven by automated tests (do NOT re-test):**
> - Both Phase 7 migrations applied + schemas/policies/triggers/indexes
>   queried via `information_schema` / `pg_policies` / `pg_indexes` / `pg_proc`.
> - All 9 Phase 7 edge fns deployed, ACTIVE (`server-time` with
>   `verify_jwt=false`, the rest with `verify_jwt=true`).
> - `pnpm test:exam` — 26/26 unit assertions (grading math + sanitisation +
>   regrade overrides + server-time helpers).
> - `pnpm smoke:exam-rls` — 12/12 RLS scenarios across PostgREST including
>   T10 ("`exam-start` response contains NO `correct_option_id` or
>   `is_correct` field anywhere") stringify-and-grep.
> - `pnpm smoke:exam-fns` — 26/26 assertions across all 9 edge fns
>   including `audit_log` row verification for `exam_submitted` +
>   `exam_results_unreleased`, replay protection on `exam-submit` (409),
>   idempotency on `exam-start`, all 3 regrade actions including the FULL-
>   recompute correctness across stacked regrades, and offline-score
>   insert-vs-update counts + out-of-range rejection.
> - `pnpm typecheck` + `pnpm lint` — all workspaces green.
> - `pnpm test --filter @fynestudy/mobile` — 6 suites / 53 tests green.
> - Supabase security advisor sweep — only the Phase-1 backlog item
>   (`auth_leaked_password_protection`) remains.
>
> So you DON'T need to verify: grading math, no-leak rule at the network
> layer (mathematically proven to omit `correct_option_id` / `is_correct`
> pre-submit and include `is_correct` post-release), idempotent re-entry,
> replay-protected submit, regrade re-scoring math, RLS scoping per batch.
>
> What you DO need to verify in this doc: that the UI **renders** the
> verified data correctly, the timer **counts down** at 1 Hz, the
> tab-switch banner **appears** when you put the app in background,
> auto-submit **fires** at the deadline, the locked-down attempt UI **is**
> locked-down (no gestures back, no animations), and `exam-attempt-result`
> renders cleanly when the teacher releases.

---

## 0. One-time setup

### 0.1 Fresh fixtures

```
pnpm seed:exam-manual-test
```

(Pass `--reset` to wipe prior `p7-*` users + `P7_TEST_*` courses first.)

Copy the printed block to a scratch file. You'll need:
- Course id + topic id (Kinematics)
- Batch A id + Batch B id
- Teacher email + password
- Student A1 + Student A2 (Batch A) email + password
- Student B1 (Batch B) email + password
- Exam 1 id (Mechanics Live — manual release, 5 Qs)
- Exam 2 id (Instant Reveal — instant release, 2 Qs)
- Exam 3 id (Scheduled Tomorrow — manual release, 5 Qs)

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

Open the Expo Go app on your phone, scan the QR. iOS Expo Go is the
primary target.

---

## A. Admin `/exams` + `/offline-scores` — visual layout (browser)

Sign in as the owner. Open `/exams`.

| # | Action | Expected |
|---|--------|----------|
| A1 | Page loads | Header reads "Exams" with subtitle "Moderate graded exams · publish · release · regrade · delete." |
| A2 | Table row count | 3 rows visible (Exam 1, 2, 3). The "Scheduled Tomorrow" row has status badge "Scheduled" (blue). Exam 1 + 2 show "Live" (rose) — possibly turning to "Closed" if you started after the 30-min / 5-min window. |
| A3 | Filter by Status = "Live" | Only live exams remain. |
| A4 | Filter by Batch = batch A | All 3 exams remain (they're all in batch A). |
| A5 | Click Export CSV | A file `exams-<today>.csv` downloads. Open it; the `starts_at_ist` column shows IST dates (not UTC). |
| A6 | Click "Unpublish" on Exam 3 (Scheduled Tomorrow) | Row's status badge changes to "Draft" (slate). Refresh — still "Draft". |
| A7 | Click "Publish" again | Back to "Scheduled". |
| A8 | Click "Force release" on Exam 1 | Status changes to "Released" (emerald). Button now reads "Un-release". |
| A9 | Click "Un-release" on Exam 1 | Status returns to "Closed" or "Live". Button reads "Force release". |
| A10 | Open `/offline-scores` | Header reads "Offline scores". Table shows 1 row — student A1's pre-seeded score 72/100 on "Weekly Paper Test …". |
| A11 | Click Export CSV (offline-scores) | Downloads `offline-scores-<today>.csv`. The `score` column is `72`, `max_score` is `100`. |
| A12 | Click "Delete" on that row, then "Cancel" | Modal closes; row remains. |
| A13 | Sidebar nav shows new items | "Exams" and "Offline scores" appear under "Quizzes" and above "Question bank". |

---

## B. Teacher workflow (mobile)

Sign in on Expo Go as the teacher.

| # | Action | Expected |
|---|--------|----------|
| B1 | Tab bar at bottom | New "Exams" tab between "Quizzes" and "Batch" (with a clipboard-check icon). |
| B2 | Tap Exams tab | List shows 3 exams. Each row has: title, batch name, IST start time, duration, status colour (red "Live now" for Exam 1+2, blue "Scheduled" for Exam 3). |
| B3 | Tap "New" (top-right) | exam-builder opens. Title empty, no batch picked, default 60-min duration. |
| B4 | Tap Batch picker | Modal lists only the batches you teach (Batch A — not Batch B, even though the course is the same). |
| B5 | Tap Starts picker | Date strip + time grid (15-min slots) modal. Tap a date + a time → "Use this time" button → modal closes with the chosen IST time displayed. |
| B6 | Tap Duration | Modal with 15/30/45/60/90/120/180 presets. |
| B7 | Tap "Add from Question Bank" | Sheet slides up showing the 5 seeded questions. Tap one — it shows "Added" with a green check. Close sheet. |
| B8 | Tap "↑" / "↓" / trash icons | Question order changes / row removes. |
| B9 | Tap "Save Draft" with empty title | Alert "Missing fields — Add title + batch + start time + duration before saving." |
| B10 | Set title + batch + future start + add 1 question, tap "Publish" | exam-builder closes; back on teacher Exams list with the new row visible. |
| B11 | Open Exam 1 (Mechanics Live) builder | Form pre-populated with the seeded values; question count = 5. |
| B12 | Back, tap "Results · Locked" pill on Exam 1 row | Opens exam-results screen for Exam 1. Shows "Results NOT released" + "Release Results to Students" button (no submissions yet, so roster says "No submitted attempts yet"). |
| B13 | Press the "← Offline" button in the Exams tab header | Opens offline-scores screen. |
| B14 | Pick Batch A, type "Weekly Paper Test X", today's date, max 50 | Roster loads with student A1 + A2. Enter "40" for A1 and "35" for A2. |
| B15 | Tap "Save All" | Alert: "Saved — 2 new, 0 updated." Re-tap Save: alert "Saved — 0 new, 2 updated." |

---

## C. Student happy-path exam attempt (mobile)

Sign out and sign in as Student A1.

| # | Action | Expected |
|---|--------|----------|
| C1 | Dashboard home | "Exams" section appears above "Weak topics". The 3 visible exams (Exam 1 "Live now", Exam 2 "Live now", Exam 3 "Scheduled" with countdown) are listed. |
| C2 | Tap Exam 3 (Scheduled Tomorrow) | Opens pre-attempt screen. Shows "Starts in X" countdown updating every second. "Enter Exam" CTA is disabled (greyed). |
| C3 | Tap Exam 1 (Mechanics Live) | Pre-attempt with red "Live now" badge + "Window closes in …" + "Enter Exam" enabled (blue). |
| C4 | Tap "Enter Exam" on Exam 1 | Locked-down attempt UI loads in <2s on mid-tier phone. Top bar shows: Close (X), title, blue timer pill "MM:SS" counting down. |
| C5 | Inspect the timer | It counts DOWN one second per tick visibly. After 60s of waiting, value has decreased by ~60s. |
| C6 | Open Safari/another app for 5 seconds, then return to Expo Go | Top of attempt page shows amber banner: "You left the app. Switches: 1". |
| C7 | Do it again 2 more times (back to home, then back) | Banner turns RED with "Switches: 3 · Further switches may be reviewed by your teacher." (Tab-switch count is fire-and-forget — no visible network hiccup.) |
| C8 | Answer Q1 (tap an option) | Blue ring appears around the option. Bottom Q-grid pill 1 turns GREEN. |
| C9 | Tap the flag button | Pill 1 turns ORANGE (flagged_unanswered if you cleared, or RED-ish if both flagged + answered). |
| C10 | Tap "Submit" (when Q5 visible) | Modal: "Submit exam? You've answered N/5, flagged M." |
| C11 | Confirm submit | Stage transitions to "Submitted — Results will be released by your teacher." A "Check release status" pill is below. |
| C12 | Take the SAME exam again (back to dashboard, tap Exam 1) | Skips intro/attempt, goes straight to the submitted-waiting screen. |

Now sign in as the teacher on a second device (or sign out + back on same):

| # | Action | Expected |
|---|--------|----------|
| C13 | Open Exam 1 → Results | Roster shows student A1 with score; question-analysis section shows per-Q % correct. |
| C14 | Tap "Release Results to Students" | Confirmation alert; tap "Release" → status flips to "Results released …" in emerald. |

Back as student A1:

| # | Action | Expected |
|---|--------|----------|
| C15 | Re-open Exam 1 | NOW lands on the "Result" screen with score X/Y, percentage, and Correct/Wrong/Skipped breakdown. |
| C16 | Tap "View Solutions" | Solution cards render. Each card shows: prompt, options with green/red badge on correct vs. selected, explanation text. |

---

## D. Edge cases (mobile)

| # | Action | Expected |
|---|--------|----------|
| D1 | Start Exam 2 (Instant Reveal), answer 1 correctly + 1 wrong, submit | Submit returns directly to RESULT screen (no submitted-waiting). Score visible immediately. |
| D2 | Take Exam 2 a second time (back, tap again) | Goes to the submitted/result screen — replay-protected (server returns 409 on second submit; client never tries because it sees a submitted attempt in pre). |
| D3 | Try Exam 3 BEFORE its start time | Pre-attempt countdown disabled; "Enter Exam" greyed. |
| D4 | Try to scroll the entire exam attempt page while no answer selected | Smooth (no Reanimated). |
| D5 | Sign in as Student B1 (Batch B) | Home dashboard shows NO exams (RLS correctly hides batch-A exams from B1). |
| D6 | Sign in as Student A1, take Exam 1, leave attempt open until TIMER hits 0 | Auto-submit fires once timer reaches 0 (you should briefly see the submit modal flash, then transition to submitted/result depending on release setting). |

---

## E. Teacher regrade flow

| # | Action | Expected |
|---|--------|----------|
| E1 | As teacher, open Exam 1 → Results (assuming Student A1 has submitted) | Roster + question-analysis visible. |
| E2 | Tap "Regrade" on any question | Modal opens with the question prompt, action picker (Change correct / Mark no correct / Mark all correct), reason field. |
| E3 | Pick "Change correct" + select a different option + reason "Wrong key" + "Apply Regrade" | Alert "Regrade complete — 1 attempt(s) recomputed." Roster score for affected student visibly changes. |
| E4 | Open `/exams` in admin browser, then click any exam to see audit_log | (Phase 11 audit_log UI not yet present; for now, owner can SQL-query `audit_log where action='exam_regrade'` via Studio.) |

---

## F. SQL sanity (one-time — what I already verified)

Don't re-run unless you want to double-check. Snapshots from my run:

| Table | Columns | RLS on | Policies |
|---|---|---|---|
| `exams` | 16 | yes | 6 |
| `exam_questions` | 4 | yes | 4 |
| `exam_attempts` | 14 | yes | 3 |
| `exam_answers` | 5 | yes | 5 |
| `offline_test_scores` | 12 | yes | 6 |

24 policies total (6+4+3+5+6). RLS on for all 5. 19 indexes (incl. 4 partial: `exams_published_idx`, `exams_release_idx`, `exam_attempts_active_idx`, `offline_test_scores_subject_idx`).

---

## G. Performance smoke (deferred — needs hardware)

Same as Phase 5/6 — Redmi 8A cold-start on `app/exam/[id].tsx`. Targets:
- Cold-start ≤ 3s
- Q→Q transition ≤ 200ms
- No frame drops in long scrolling
- One WebView max mounted (the existing rule from CLAUDE.md — exam screen mounts MathText only on Qs with KaTeX delimiters, so worst-case it mounts 5 lightweight WebViews per question if all 5 options contain math)

Deferred until Redmi 8A device is available.

---

## H. What's already proven by automated tests (DO NOT re-test)

See the top-of-doc list. The key non-obvious ones:

- The `exam-start` response is **mathematically** proven to omit
  `correct_option_id` and `is_correct` everywhere (stringify-and-grep in
  RLS smoke T10).
- The `exam-submit` 409 replay protection is proven.
- All 3 regrade actions (change_correct / mark_no_correct /
  mark_all_correct) are proven to produce the correct score AFTER stacked
  regrades. The fix for the original delta-math drift bug is the new
  `regrade_override` field on the snapshot (D-179).
- `offline-score-upsert` validation (student-in-batch, score ≤ max,
  inserted-vs-updated counts) is proven via HTTP smoke.

---

## I. Report-back format

When you find a bug, please paste:

- The numbered step (e.g. "C6") that failed.
- The visible error message, if any.
- A screenshot or short video clip if it's a rendering/animation issue.
- The relevant log line from Metro / Vercel console.

For UI-only bugs (font cut, wrong colour, off-by-one padding) — a screenshot
is enough; no need to dig for logs.

For backend-related bugs (rejected submit, wrong score, RLS leakage) — open
Supabase Studio → Logs → "Edge Logs" tab, filter to the function name, and
paste the matching request entry.
