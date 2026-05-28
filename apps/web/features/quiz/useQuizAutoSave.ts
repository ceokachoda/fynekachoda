"use client";

// 250ms debounced upsert into `public.quiz_answers`. RLS allows the student
// to upsert rows for their own in-flight attempt. Mirrors the mobile
// useQuizAutoSave shape (same enqueue/flush API).
//
// `is_correct` MUST NEVER appear in the payload — quiz_answers only stores
// the student's selection; grading happens server-side at submit.

import { useCallback, useEffect, useRef } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

const DEBOUNCE_MS = 250;

export interface AnswerState {
  question_id: string;
  selected_option_id: string | null;
  is_flagged: boolean;
}

interface Options {
  attemptId: string | null;
  onError?: (msg: string) => void;
}

interface State {
  enqueue: (a: AnswerState) => void;
  flush: () => Promise<void>;
}

export function useQuizAutoSave({ attemptId, onError }: Options): State {
  const pendingRef = useRef<Map<string, AnswerState>>(new Map());
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
      .from("quiz_answers")
      .upsert(rows, { onConflict: "attempt_id,question_id" });
    if (res.error) {
      // Re-queue + surface so the screen can show a toast.
      for (const r of batch) pendingRef.current.set(r.question_id, r);
      onErrorRef.current?.(res.error.message);
    }
  }, [attemptId]);

  const enqueue = useCallback(
    (a: AnswerState) => {
      pendingRef.current.set(a.question_id, a);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        void flush();
      }, DEBOUNCE_MS);
    },
    [flush],
  );

  // Flush remaining changes on unmount + when attemptId changes so a
  // navigate-away doesn't lose state.
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
