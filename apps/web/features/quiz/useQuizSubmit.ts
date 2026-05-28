"use client";

// POST quiz-submit { attempt_id } → server grades + returns full solution
// payload (including `is_correct` per option, post-submit only).

import { useCallback, useState } from "react";
import { invokeEdgeFn } from "@/lib/edge-fn";
import type { QuizSubmitResponse } from "./types";

interface State {
  isSubmitting: boolean;
  error: string | null;
  submit: (attemptId: string) => Promise<QuizSubmitResponse | null>;
}

export function useQuizSubmit(): State {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(
    async (attemptId: string): Promise<QuizSubmitResponse | null> => {
      setIsSubmitting(true);
      setError(null);
      try {
        const { status, body, error: invokeErr } = await invokeEdgeFn<
          QuizSubmitResponse | { error: string }
        >("quiz-submit", { attempt_id: attemptId });
        if (invokeErr) {
          setError(invokeErr);
          return null;
        }
        if (status === 200 && body && "attempt_id" in body) {
          return body;
        }
        const msg =
          body && "error" in body ? body.error : `quiz-submit failed (${status})`;
        setError(msg);
        return null;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not submit quiz.");
        return null;
      } finally {
        setIsSubmitting(false);
      }
    },
    [],
  );

  return { isSubmitting, error, submit };
}
