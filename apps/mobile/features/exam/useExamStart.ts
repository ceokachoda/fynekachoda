import { useCallback, useEffect, useState } from "react";
import { invokeEdgeFn } from "@/lib/edge-fn";
import type { ExamStartResponse } from "./types";

interface State {
  data: ExamStartResponse | null;
  isLoading: boolean;
  error: string | null;
  load: () => Promise<void>;
}

export function useExamStart(examId: string | null): State {
  const [data, setData] = useState<ExamStartResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!examId) return;
    setIsLoading(true);
    setError(null);
    try {
      const { status, body, error: invokeErr } = await invokeEdgeFn<
        ExamStartResponse | { error: string; detail?: unknown }
      >("exam-start", { exam_id: examId });
      if (invokeErr) {
        setError(invokeErr);
        return;
      }
      if (status === 200 && body && "attempt_id" in body) {
        setData(body);
      } else if (body && "error" in body) {
        setError(body.error);
      } else {
        setError(`exam-start failed (${status})`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start exam.");
    } finally {
      setIsLoading(false);
    }
  }, [examId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, isLoading, error, load };
}
