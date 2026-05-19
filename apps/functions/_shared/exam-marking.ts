// Phase 7 — pure helpers for the exam-submit + exam-regrade grading paths.
// Unit-tested in `scripts/test-exam-helpers.ts`. Kept dep-free so the same
// code runs under Deno (edge fn) and Node (tests). Mirrors Phase 6's
// `quiz-marking.ts` but reads from the per-attempt `question_snapshot`
// payload (D-052: live edits do NOT change in-flight attempts).

export type Outcome = "correct" | "wrong" | "skipped";

export interface ExamMarking {
  marks_correct: number;
  marks_wrong: number;
  marks_skip: number;
}

export interface SnapshotOption {
  id: string;
  text_md: string;
  image_path: string | null;
}

export interface SnapshotQuestion {
  id: string;
  prompt_md: string;
  prompt_image_path: string | null;
  difficulty: string | null;
  topic_id: string;
  options: SnapshotOption[];
  // Server-side only — NEVER serialised to the student client during attempt.
  correct_option_id: string | null;
  // Set by `exam-regrade` to encode bank mutations:
  //   "all"  → everyone gets marks_correct on this question
  //   "none" → everyone gets marks_skip on this question
  //   undefined/null → grade against correct_option_id as normal
  // Allows regrades to layer without losing prior intent.
  regrade_override?: "all" | "none" | null;
}

export interface ExamSnapshot {
  questions: SnapshotQuestion[];
}

export interface AnswerInput {
  question_id: string;
  selected_option_id: string | null;
  // The canonical correct option to grade against. For normal submit this is
  // pulled from the snapshot; for regrade it's pulled from the LIVE
  // `question_options.is_correct` (so the new key is honoured).
  correct_option_id: string | null;
  // Optional override applied AFTER computing the base outcome — encodes
  // mark_no_correct ("none") and mark_all_correct ("all") regrades.
  regrade_override?: "all" | "none" | null;
}

export interface PerQuestionResult {
  question_id: string;
  selected_option_id: string | null;
  correct_option_id: string | null;
  outcome: Outcome;
  points: number;
}

export interface AttemptScore {
  score: number;
  max_score: number;
  correct_count: number;
  wrong_count: number;
  skipped_count: number;
  per_question: PerQuestionResult[];
}

// Single-question grading. Mark-all-correct (`correct_option_id` matches
// whatever the student picked) and mark-no-correct (no correct option) are
// handled by the caller transforming the snapshot.correct_option_id before
// passing it in. See `gradeAttempt` for the all-correct / no-correct
// branches and how regrade reuses this.
export function gradeAnswer(
  ans: AnswerInput,
  marks: ExamMarking,
): PerQuestionResult {
  // Regrade overrides win unconditionally — set by exam-regrade.
  if (ans.regrade_override === "none") {
    return {
      question_id: ans.question_id,
      selected_option_id: ans.selected_option_id,
      correct_option_id: null,
      outcome: "skipped",
      points: marks.marks_skip,
    };
  }
  if (ans.regrade_override === "all") {
    return {
      question_id: ans.question_id,
      selected_option_id: ans.selected_option_id,
      correct_option_id: ans.correct_option_id,
      outcome: "correct",
      points: marks.marks_correct,
    };
  }
  if (ans.selected_option_id === null) {
    return {
      question_id: ans.question_id,
      selected_option_id: null,
      correct_option_id: ans.correct_option_id,
      outcome: "skipped",
      points: marks.marks_skip,
    };
  }
  if (ans.correct_option_id && ans.selected_option_id === ans.correct_option_id) {
    return {
      question_id: ans.question_id,
      selected_option_id: ans.selected_option_id,
      correct_option_id: ans.correct_option_id,
      outcome: "correct",
      points: marks.marks_correct,
    };
  }
  return {
    question_id: ans.question_id,
    selected_option_id: ans.selected_option_id,
    correct_option_id: ans.correct_option_id,
    outcome: "wrong",
    points: marks.marks_wrong,
  };
}

export function gradeAttempt(
  answers: AnswerInput[],
  marks: ExamMarking,
): AttemptScore {
  let score = 0;
  let correct_count = 0;
  let wrong_count = 0;
  let skipped_count = 0;
  const per_question: PerQuestionResult[] = [];
  for (const a of answers) {
    const r = gradeAnswer(a, marks);
    per_question.push(r);
    score += r.points;
    if (r.outcome === "correct") correct_count++;
    else if (r.outcome === "wrong") wrong_count++;
    else skipped_count++;
  }
  return {
    score,
    max_score: answers.length * marks.marks_correct,
    correct_count,
    wrong_count,
    skipped_count,
    per_question,
  };
}

// Strip the server-only `correct_option_id` from every question in the
// snapshot before sending to the student client during an attempt.
export function sanitiseSnapshotForStudent(snapshot: ExamSnapshot): {
  questions: Array<Omit<SnapshotQuestion, "correct_option_id">>;
} {
  return {
    questions: snapshot.questions.map((q) => ({
      id: q.id,
      prompt_md: q.prompt_md,
      prompt_image_path: q.prompt_image_path,
      difficulty: q.difficulty,
      topic_id: q.topic_id,
      options: q.options,
    })),
  };
}

// Regrade re-scores every attempt of an exam using the LIVE
// `question_options.is_correct` for the target question. Other questions
// keep their snapshot-time correct_option_id.
//
// `regradeMode`:
//   - "change_correct": pass `live_correct_option_id` as the new key.
//   - "mark_all_correct": pass `selected_option_id` as the key (i.e., any
//     answer is "correct"). Empty answers stay skipped per spec.
//   - "mark_no_correct": pass `null` so EVERY answered choice becomes
//     "wrong"... but spec §5.8 says "everyone gets marks_skip", so we
//     override the outcome to "skipped" at the caller level.
export function regradedCorrectOptionId(
  mode: "change_correct" | "mark_all_correct" | "mark_no_correct",
  liveCorrectOptionId: string | null,
  selectedOptionId: string | null,
): string | null {
  if (mode === "change_correct") return liveCorrectOptionId;
  if (mode === "mark_all_correct") return selectedOptionId; // matches anything answered
  return null; // mark_no_correct — combined with outcome override below
}

// For `mark_no_correct`, spec says everyone gets `marks_skip` — outcome is
// "skipped" regardless of what they answered. Apply after `gradeAnswer`.
export function applyMarkNoCorrectOverride(
  r: PerQuestionResult,
  marks: ExamMarking,
): PerQuestionResult {
  return {
    ...r,
    correct_option_id: null,
    outcome: "skipped",
    points: marks.marks_skip,
  };
}

// For `mark_all_correct`, spec says everyone gets `marks_correct`. We need
// to force the outcome to "correct" even when the student skipped — so
// override after `gradeAnswer`.
export function applyMarkAllCorrectOverride(
  r: PerQuestionResult,
  marks: ExamMarking,
): PerQuestionResult {
  return {
    ...r,
    outcome: "correct",
    points: marks.marks_correct,
  };
}

export function shuffleStable<T>(arr: readonly T[], rng = Math.random): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Compute server-anchored remaining seconds. Late entry (student joins after
// starts_at) still gets only `min(starts_at + duration, now + duration) - now`
// remaining time per D-052. Caller passes pre-parsed ISO dates.
export function computeRemainingSec(
  now: Date,
  startsAt: Date,
  durationMin: number,
): number {
  const hardCutMs = startsAt.getTime() + durationMin * 60_000;
  const remainingMs = hardCutMs - now.getTime();
  if (remainingMs < 0) return 0;
  return Math.floor(remainingMs / 1000);
}

// Server-time enforcement for submit. Returns true if the submission lands
// past `starts_at + duration_min` and should be auto-flagged.
export function isAutoSubmittedAt(
  submittedAt: Date,
  startsAt: Date,
  durationMin: number,
): boolean {
  return submittedAt.getTime() > startsAt.getTime() + durationMin * 60_000;
}
