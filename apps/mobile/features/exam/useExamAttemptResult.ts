import { useCallback, useEffect, useState } from "react";
import { invokeEdgeFn } from "@/lib/edge-fn";
import type { ExamAttemptResultResponse } from "./types";

interface State {
  data: ExamAttemptResultResponse | null;
  isLoading: boolean;
  error: string | null;
  locked: boolean; // 423: awaiting teacher release
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
      } else if (status === 423) {
        setLocked(true);
      } else if (body && "error" in body) {
        setError(body.error);
      } else {
        setError(`fetch failed (${status})`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load result.");
    } finally {
      setIsLoading(false);
    }
  }, [attemptId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, isLoading, error, locked, reload };
}
