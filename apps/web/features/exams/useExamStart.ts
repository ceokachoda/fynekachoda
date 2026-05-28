"use client";

// POST exam-start { exam_id } → idempotent attempt + sanitised snapshot
// (no `correct_option_id`, no `is_correct`). Server enforces the
// [starts_at, starts_at+duration) window.
//
// Triggered manually on Enter Exam (via load()) — not on mount — because
// exam-start refuses before the window opens.

import { useCallback, useState } from "react";
import { invokeEdgeFn } from "@/lib/edge-fn";
import type { ExamStartResponse } from "./types";

interface State {
  data: ExamStartResponse | null;
  isLoading: boolean;
  error: string | null;
  load: () => Promise<ExamStartResponse | null>;
  reset: () => void;
}

export function useExamStart(examId: string | null): State {
  const [data, setData] = useState<ExamStartResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!examId) return null;
    setIsLoading(true);
    setError(null);
    try {
      const { status, body, error: invokeErr } = await invokeEdgeFn<
        ExamStartResponse | { error: string }
      >("exam-start", { exam_id: examId });
      if (invokeErr) {
        setError(invokeErr);
        return null;
      }
      if (status === 200 && body && "attempt_id" in body) {
        setData(body);
        return body;
      }
      const msg = body && "error" in body ? body.error : `exam-start failed (${status})`;
      setError(msg);
      return null;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start exam.");
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [examId]);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
  }, []);

  return { data, isLoading, error, load, reset };
}
