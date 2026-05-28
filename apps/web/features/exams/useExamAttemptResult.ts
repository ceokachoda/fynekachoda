"use client";

// POST exam-attempt-result { attempt_id } → submitted result + per-question
// solution dossier. Handles HTTP 423 (locked / awaiting teacher release) by
// surfacing `locked = true`; the UI shows the waiting message + a refresh
// affordance + auto-refetches on window focus.

import { useCallback, useEffect, useState } from "react";
import { invokeEdgeFn } from "@/lib/edge-fn";
import type { ExamAttemptResultResponse } from "./types";

interface State {
  data: ExamAttemptResultResponse | null;
  isLoading: boolean;
  error: string | null;
  locked: boolean;
  reload: () => Promise<void>;
}

export function useExamAttemptResult(attemptId: string | null): State {
  const [data, setData] = useState<ExamAttemptResultResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);

  const reload = useCallback(async () => {
    if (!attemptId) return;
    setIsLoading(true);
    setError(null);
    setLocked(false);
    try {
      const { status, body, error: invokeErr } = await invokeEdgeFn<
        ExamAttemptResultResponse | { error: string }
      >("exam-attempt-result", { attempt_id: attemptId });
      if (invokeErr) {
        setError(invokeErr);
        return;
      }
      if (status === 200 && body && "attempt_id" in body) {
        setData(body);
        return;
      }
      if (status === 423) {
        setLocked(true);
        return;
      }
      const msg =
        body && "error" in body
          ? body.error
          : `exam-attempt-result failed (${status})`;
      setError(msg);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load result.");
    } finally {
      setIsLoading(false);
    }
  }, [attemptId]);

  useEffect(() => {
    if (attemptId) void reload();
  }, [attemptId, reload]);

  // Refetch on window focus — if the teacher released results while the tab
  // was backgrounded, this picks them up the moment the student returns.
  useEffect(() => {
    if (!attemptId) return;
    const handler = () => {
      void reload();
    };
    window.addEventListener("focus", handler);
    return () => window.removeEventListener("focus", handler);
  }, [attemptId, reload]);

  return { data, isLoading, error, locked, reload };
}
