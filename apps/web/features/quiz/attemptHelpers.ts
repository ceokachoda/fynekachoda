// Pure helpers extracted from QuizClient + ExamClient so they're unit-testable
// without rendering React.

import type { QuestionStatus } from "@/components/quiz/NavigationGrid";

export interface AnswerLike {
  selected_option_id: string | null;
  is_flagged: boolean;
}

export interface QuestionLike {
  id: string;
}

export function computeStatuses(
  questions: QuestionLike[],
  answers: Map<string, AnswerLike>,
): QuestionStatus[] {
  return questions.map((q) => {
    const a = answers.get(q.id);
    const answered = !!a?.selected_option_id;
    const flagged = !!a?.is_flagged;
    if (flagged && answered) return "flagged_answered";
    if (flagged) return "flagged_unanswered";
    if (answered) return "answered";
    return "unanswered";
  });
}

export function countAnswered(answers: Map<string, AnswerLike>): number {
  let n = 0;
  for (const a of answers.values()) if (a.selected_option_id) n += 1;
  return n;
}

export function countFlagged(answers: Map<string, AnswerLike>): number {
  let n = 0;
  for (const a of answers.values()) if (a.is_flagged) n += 1;
  return n;
}

export function unansweredIndices(
  questions: QuestionLike[],
  answers: Map<string, AnswerLike>,
): number[] {
  const out: number[] = [];
  for (let i = 0; i < questions.length; i += 1) {
    const q = questions[i];
    if (!q) continue;
    const a = answers.get(q.id);
    if (!a?.selected_option_id) out.push(i);
  }
  return out;
}
