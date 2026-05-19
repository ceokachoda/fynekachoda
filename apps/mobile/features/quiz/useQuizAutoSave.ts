import { useCallback, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { withTimeout } from "@/features/auth/network-errors";

export interface AnswerState {
  question_id: string;
  selected_option_id: string | null;
  is_flagged: boolean;
}

interface Options {
  attemptId: string | null;
  /** Called when a save fails (we keep retrying with the next change). */
  onError?: (msg: string) => void;
}

// Debounced auto-save to `public.quiz_answers`. Each call coalesces multiple
// pending updates per question_id into one upsert. RLS allows the student to
// upsert rows for their own in-flight attempt.
export function useQuizAutoSave({ attemptId, onError }: Options) {
  const pendingRef = useRef<Map<string, AnswerState>>(new Map());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  const flush = useCallback(async () => {
    if (!attemptId) return;
    const batch = Array.from(pendingRef.current.values());
    pendingRef.current.clear();
    if (batch.length === 0) return;

    const payload = batch.map((a) => ({
      attempt_id: attemptId,
      question_id: a.question_id,
      selected_option_id: a.selected_option_id,
      is_flagged: a.is_flagged,
      answered_at: a.selected_option_id ? new Date().toISOString() : null,
    }));

    try {
      const res = await withTimeout(
        supabase
          .from("quiz_answers")
          .upsert(payload, { onConflict: "attempt_id,question_id" }),
      );
      if (res.error) {
        onErrorRef.current?.(res.error.message);
      }
    } catch (err) {
      onErrorRef.current?.(
        err instanceof Error ? err.message : "save failed",
      );
    }
  }, [attemptId]);

  const enqueue = useCallback(
    (next: AnswerState) => {
      pendingRef.current.set(next.question_id, next);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        void flush();
      }, 250);
    },
    [flush],
  );

  // Flush remaining changes on unmount so a tap-then-leave doesn't lose state.
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      void flush();
    };
  }, [flush]);

  return { enqueue, flush };
}
