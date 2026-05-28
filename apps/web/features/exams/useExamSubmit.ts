"use client";

// POST exam-submit { attempt_id } — manual or auto-submit at deadline.

import { useCallback, useState } from "react";
import { invokeEdgeFn } from "@/lib/edge-fn";
import type { ExamSubmitResponse } from "./types";

interface State {
  isSubmitting: boolean;
  error: string | null;
  submit: (attemptId: string) => Promise<ExamSubmitResponse | null>;
}

export function useExamSubmit(): State {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(
    async (attemptId: string): Promise<ExamSubmitResponse | null> => {
      setIsSubmitting(true);
      setError(null);
      try {
        const { status, body, error: invokeErr } = await invokeEdgeFn<
          ExamSubmitResponse | { error: string }
        >("exam-submit", { attempt_id: attemptId });
        if (invokeErr) {
          setError(invokeErr);
          return null;
        }
        if (status === 200 && body && "attempt_id" in body) {
          return body;
        }
        const msg =
          body && "error" in body ? body.error : `exam-submit failed (${status})`;
        setError(msg);
        return null;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not submit exam.");
        return null;
      } finally {
        setIsSubmitting(false);
      }
    },
    [],
  );

  return { isSubmitting, error, submit };
}
