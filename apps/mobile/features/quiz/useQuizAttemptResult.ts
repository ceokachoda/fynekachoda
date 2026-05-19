import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  isNetworkError,
  NETWORK_ERROR_MESSAGE,
  withTimeout,
} from "@/features/auth/network-errors";
import type { QuizSubmitResponse } from "./types";

interface State {
  data: QuizSubmitResponse | null;
  isLoading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

export function useQuizAttemptResult(attemptId: string | null): State {
  const [data, setData] = useState<QuizSubmitResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!attemptId) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await withTimeout(
        supabase.functions.invoke<QuizSubmitResponse>(
          "quiz-attempt-result",
          { body: { attempt_id: attemptId } },
        ),
      );
      if (res.error) {
        setError(
          (res.error as Error).message ?? "Could not load result.",
        );
        return;
      }
      setData(res.data ?? null);
    } catch (err) {
      setError(
        isNetworkError(err)
          ? NETWORK_ERROR_MESSAGE
          : "Could not load result.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [attemptId]);

  useEffect(() => {
    if (attemptId) void reload();
  }, [attemptId, reload]);

  return { data, isLoading, error, reload };
}
