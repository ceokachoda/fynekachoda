// Pure helpers for the Phase 6 quiz-submit grading path. Unit-tested in
// `scripts/test-quiz-helpers.ts`. Kept dep-free so the same code can run
// under Deno (edge fn) and Node (tests).

export type Outcome = "correct" | "wrong" | "skipped";

export interface Marking {
  marks_correct: number;
  marks_wrong: number;
  marks_skip: number;
}

export interface AnswerInput {
  question_id: string;
  selected_option_id: string | null;
  correct_option_id: string | null;
}

export interface PerQuestionResult {
  question_id: string;
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

export function gradeAnswer(
  ans: AnswerInput,
  marks: Marking,
): PerQuestionResult {
  if (ans.selected_option_id === null) {
    return {
      question_id: ans.question_id,
      outcome: "skipped",
      points: marks.marks_skip,
    };
  }
  if (ans.correct_option_id && ans.selected_option_id === ans.correct_option_id) {
    return {
      question_id: ans.question_id,
      outcome: "correct",
      points: marks.marks_correct,
    };
  }
  return {
    question_id: ans.question_id,
    outcome: "wrong",
    points: marks.marks_wrong,
  };
}

export function gradeAttempt(
  answers: AnswerInput[],
  marks: Marking,
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

// KaTeX delimiter detector — matches the regex used in MathText component on
// mobile. Keep the two in sync.
export const MATH_DELIMITER_REGEX = /\$\$?[^$]+\$\$?|\\\(|\\\[/;
export function containsMath(s: string): boolean {
  return MATH_DELIMITER_REGEX.test(s);
}

// Stable Fisher–Yates shuffle for snapshot generation. Identity-preserving
// for length === 1. Pure (does NOT mutate input).
export function shuffleStable<T>(arr: readonly T[], rng = Math.random): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Snapshot ordering: given a metadata.question_order from a saved attempt,
// drop ids that no longer exist (e.g., admin archived a question) and append
// any new ids in canonical order.
export function reconcileOrder(
  saved: readonly string[] | undefined,
  canonical: readonly string[],
): string[] {
  const known = new Set(canonical);
  const out = (saved ?? []).filter((id) => known.has(id));
  for (const id of canonical) {
    if (!out.includes(id)) out.push(id);
  }
  return out;
}
