"use client";

// POST quiz-attempt-result { attempt_id } → re-fetch a SUBMITTED attempt's
// result payload. Solves "student closed the tab, wants to re-open
// solutions" — signed image URLs are short-lived so a fresh sign happens
// per call.
//
// Phase 3 cache hygiene: query key `["quiz-result", attemptId]` MUST be
// disjoint from the attempt-stage key `["quiz-attempt", attemptId]` so the
// result-stage payload (which carries `is_correct`) cannot overwrite the
// attempt-stage cache.

import { useCallback, useEffect, useState } from "react";
import { invokeEdgeFn } from "@/lib/edge-fn";
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
      const { status, body, error: invokeErr } = await invokeEdgeFn<
        QuizSubmitResponse | { error: string }
      >("quiz-attempt-result", { attempt_id: attemptId });
      if (invokeErr) {
        setError(invokeErr);
        return;
      }
      if (status === 200 && body && "attempt_id" in body) {
        setData(body);
        return;
      }
      const msg =
        body && "error" in body ? body.error : `quiz-attempt-result failed (${status})`;
      setError(msg);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load result.");
    } finally {
      setIsLoading(false);
    }
  }, [attemptId]);

  useEffect(() => {
    if (attemptId) void reload();
  }, [attemptId, reload]);

  return { data, isLoading, error, reload };
}
