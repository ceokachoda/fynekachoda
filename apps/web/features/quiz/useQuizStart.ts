"use client";

// POST quiz-start { quiz_id } → { attempt_id, questions (no is_correct),
// server_now, deadline_at, saved_answers, … }.
//
// Phase 3 invariant: this query NEVER caches `is_correct`. The server fn
// strips it before responding; the `QuizStartResponse` type forbids it. To
// keep the React Query cache hygienic, this query key is intentionally
// disjoint from `["quiz-result", attemptId]`.

import { useCallback, useEffect, useState } from "react";
import { invokeEdgeFn } from "@/lib/edge-fn";
import type { QuizStartResponse } from "./types";

interface State {
  data: QuizStartResponse | null;
  isLoading: boolean;
  error: string | null;
  load: () => Promise<void>;
  reset: () => void;
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
      const { status, body, error: invokeErr } = await invokeEdgeFn<
        QuizStartResponse | { error: string }
      >("quiz-start", { quiz_id: quizId });
      if (invokeErr) {
        setError(invokeErr);
        return;
      }
      if (status === 200 && body && "attempt_id" in body) {
        setData(body);
        return;
      }
      const msg = body && "error" in body ? body.error : `quiz-start failed (${status})`;
      setError(msg);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start quiz.");
    } finally {
      setIsLoading(false);
    }
  }, [quizId]);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
  }, []);

  useEffect(() => {
    if (quizId) void load();
  }, [quizId, load]);

  return { data, isLoading, error, load, reset };
}
