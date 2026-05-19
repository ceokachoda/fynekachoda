import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  isNetworkError,
  NETWORK_ERROR_MESSAGE,
  withTimeout,
} from "@/features/auth/network-errors";
import type { QuizStartResponse } from "./types";

interface State {
  data: QuizStartResponse | null;
  isLoading: boolean;
  error: string | null;
  load: () => Promise<void>;
}

export function useQuizStart(quizId: string | null): State {
  const [data, setData] = useState<QuizStartResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!quizId) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await withTimeout(
        supabase.functions.invoke<QuizStartResponse>("quiz-start", {
          body: { quiz_id: quizId },
        }),
      );
      if (res.error) {
        setError(
          (res.error as Error).message ?? "Could not start quiz.",
        );
        return;
      }
      setData(res.data ?? null);
    } catch (err) {
      setError(
        isNetworkError(err)
          ? NETWORK_ERROR_MESSAGE
          : "Could not start quiz.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [quizId]);

  useEffect(() => {
    if (quizId) void load();
  }, [quizId, load]);

  return { data, isLoading, error, load };
}
