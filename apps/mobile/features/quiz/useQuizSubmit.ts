import { useCallback, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  isNetworkError,
  NETWORK_ERROR_MESSAGE,
  withTimeout,
} from "@/features/auth/network-errors";
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
        const res = await withTimeout(
          supabase.functions.invoke<QuizSubmitResponse>("quiz-submit", {
            body: { attempt_id: attemptId },
          }),
        );
        if (res.error) {
          setError(
            (res.error as Error).message ?? "Could not submit quiz.",
          );
          return null;
        }
        return res.data ?? null;
      } catch (err) {
        setError(
          isNetworkError(err)
            ? NETWORK_ERROR_MESSAGE
            : "Could not submit quiz.",
        );
        return null;
      } finally {
        setIsSubmitting(false);
      }
    },
    [],
  );

  return { isSubmitting, error, submit };
}
