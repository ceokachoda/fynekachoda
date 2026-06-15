"use server";

import { z } from "zod";
import { callEdgeFn, requireAdmin } from "@/lib/auth";

// Per-question option as returned by the quiz-attempt-result edge fn.
export interface AttemptDetailOption {
  id: string;
  text_md: string;
  image_url: string | null;
  is_correct: boolean;
}

export interface AttemptDetailQuestion {
  id: string;
  prompt_md: string;
  prompt_image_url: string | null;
  difficulty: string | null;
  options: AttemptDetailOption[];
  explanation_md: string | null;
  your_option_id: string | null;
  correct_option_id: string | null;
  outcome: "correct" | "wrong" | "skipped";
  points: number;
  is_flagged: boolean;
}

export interface AttemptDetail {
  attempt_id: string;
  score: number;
  max_score: number;
  correct_count: number;
  wrong_count: number;
  skipped_count: number;
  started_at: string;
  submitted_at: string;
  is_auto_submit: boolean;
  questions: AttemptDetailQuestion[];
}

export interface AttemptDetailState {
  error?: string;
  detail?: AttemptDetail;
}

const Input = z.object({ attempt_id: z.string().uuid() });

// Read-only: re-fetches a submitted attempt's full per-question solution payload
// (chosen vs correct option, marks, explanation, signed images). Reuses the
// already-admin-authorized `quiz-attempt-result` edge fn — no DB write, no audit.
export async function getQuizAttemptDetailAction(
  attemptId: string,
): Promise<AttemptDetailState> {
  const parsed = Input.safeParse({ attempt_id: attemptId });
  if (!parsed.success) return { error: "Invalid attempt id." };
  const session = await requireAdmin();
  const result = await callEdgeFn<AttemptDetail & { error?: string }>(
    "quiz-attempt-result",
    { attempt_id: parsed.data.attempt_id },
    session.access_token,
  );
  if (result.status !== 200) {
    const d = result.data as { error?: string };
    return { error: d?.error ?? `Failed to load attempt (status ${result.status}).` };
  }
  return { detail: result.data as AttemptDetail };
}
