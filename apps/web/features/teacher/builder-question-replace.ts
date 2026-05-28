// Phase 4 Track 4B — pure helpers for the atomic question-replace strategy
// (Phase-7 carry-over): build the upsert + cleanup-delete row sets so the
// builder NEVER leaves an exam empty mid-save.
//
// Strategy (mirrors the mobile exam-builder):
// 1. Upsert {exam_id, question_id, sort_order} for every desired question →
//    onConflict('exam_id,question_id') updates sort_order for rows already
//    there and inserts the new ones.
// 2. THEN delete the rows whose question_id is no longer in the desired set.
// A delete-then-insert leaves a published exam empty if the insert fails.

export interface ReplacePlan<T> {
  upsertRows: T[];
  deleteCondition: { equals: { column: "exam_id" | "quiz_id"; value: string }; notIn: string[] };
  isEmpty: boolean;
}

export function buildExamQuestionReplacePlan(
  examId: string,
  questionIds: string[],
): ReplacePlan<{
  exam_id: string;
  question_id: string;
  sort_order: number;
}> {
  return {
    upsertRows: questionIds.map((qid, i) => ({
      exam_id: examId,
      question_id: qid,
      sort_order: i,
    })),
    deleteCondition: {
      equals: { column: "exam_id", value: examId },
      notIn: questionIds,
    },
    isEmpty: questionIds.length === 0,
  };
}

export function buildQuizQuestionReplacePlan(
  quizId: string,
  questionIds: string[],
): ReplacePlan<{
  quiz_id: string;
  question_id: string;
  sort_order: number;
}> {
  return {
    upsertRows: questionIds.map((qid, i) => ({
      quiz_id: quizId,
      question_id: qid,
      sort_order: i,
    })),
    deleteCondition: {
      equals: { column: "quiz_id", value: quizId },
      notIn: questionIds,
    },
    isEmpty: questionIds.length === 0,
  };
}

// Helper for the up/down arrow reorder. Returns a new array; never mutates.
export function reorder<T>(
  arr: readonly T[],
  fromIndex: number,
  direction: -1 | 1,
): T[] {
  const next = arr.slice();
  const toIndex = fromIndex + direction;
  if (fromIndex < 0 || fromIndex >= next.length) return next;
  if (toIndex < 0 || toIndex >= next.length) return next;
  const tmp = next[fromIndex]!;
  next[fromIndex] = next[toIndex]!;
  next[toIndex] = tmp;
  return next;
}
