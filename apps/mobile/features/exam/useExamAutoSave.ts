// Debounced upsert into public.exam_answers. RLS permits when the attempt
// is in-flight (submitted_at IS NULL). Mirrors Phase 6's useQuizAutoSave
// shape — same enqueue/flush API.

import { useCallback, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

interface EnqueueArgs {
  question_id: string;
  selected_option_id: string | null;
  is_flagged: boolean;
}

interface State {
  enqueue: (a: EnqueueArgs) => void;
  flush: () => Promise<void>;
}

const DEBOUNCE_MS = 500;

export function useExamAutoSave({ attemptId }: { attemptId: string | null }): State {
  const pending = useRef<Map<string, EnqueueArgs>>(new Map());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(async () => {
    if (!attemptId) return;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const batch = Array.from(pending.current.values());
    pending.current.clear();
    if (batch.length === 0) return;
    const rows = batch.map((b) => ({
      attempt_id: attemptId,
      question_id: b.question_id,
      selected_option_id: b.selected_option_id,
      is_flagged: b.is_flagged,
      answered_at: b.selected_option_id ? new Date().toISOString() : null,
    }));
    const res = await supabase
      .from("exam_answers")
      .upsert(rows, { onConflict: "attempt_id,question_id" });
    if (res.error) {
      // Re-queue for the next debounce cycle so we don't lose state.
      for (const r of batch) pending.current.set(r.question_id, r);
    }
  }, [attemptId]);

  const enqueue = useCallback(
    (a: EnqueueArgs) => {
      pending.current.set(a.question_id, a);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        void flush();
      }, DEBOUNCE_MS);
    },
    [flush],
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      void flush();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptId]);

  return { enqueue, flush };
}
