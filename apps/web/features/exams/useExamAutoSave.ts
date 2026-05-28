"use client";

// 500ms debounced upsert into `public.exam_answers`. Server enforces the
// deadline at the RLS layer (D-183): writes after `deadline_at` are 403'd,
// so a late-tap-after-auto-submit doesn't corrupt the attempt.

import { useCallback, useEffect, useRef } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

const DEBOUNCE_MS = 500;

export interface ExamAnswerState {
  question_id: string;
  selected_option_id: string | null;
  is_flagged: boolean;
}

interface Options {
  attemptId: string | null;
  onError?: (msg: string) => void;
}

interface State {
  enqueue: (a: ExamAnswerState) => void;
  flush: () => Promise<void>;
}

export function useExamAutoSave({ attemptId, onError }: Options): State {
  const pendingRef = useRef<Map<string, ExamAnswerState>>(new Map());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  const flush = useCallback(async () => {
    if (!attemptId) return;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const batch = Array.from(pendingRef.current.values());
    pendingRef.current.clear();
    if (batch.length === 0) return;
    const supabase = createSupabaseBrowserClient();
    const rows = batch.map((a) => ({
      attempt_id: attemptId,
      question_id: a.question_id,
      selected_option_id: a.selected_option_id,
      is_flagged: a.is_flagged,
      answered_at: a.selected_option_id ? new Date().toISOString() : null,
    }));
    const res = await supabase
      .from("exam_answers")
      .upsert(rows, { onConflict: "attempt_id,question_id" });
    if (res.error) {
      // Re-queue: a transient network / RLS-window glitch shouldn't drop the
      // student's selection. The deadline-cut RLS will reject AFTER the
      // server deadline — that's the right behaviour and we surface it.
      for (const r of batch) pendingRef.current.set(r.question_id, r);
      onErrorRef.current?.(res.error.message);
    }
  }, [attemptId]);

  const enqueue = useCallback(
    (a: ExamAnswerState) => {
      pendingRef.current.set(a.question_id, a);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        void flush();
      }, DEBOUNCE_MS);
    },
    [flush],
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      void flush();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptId]);

  return { enqueue, flush };
}
