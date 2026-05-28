"use client";

// Pre-attempt header info (loaded directly from `exams` — RLS scopes to
// batch). Drives the pre-stage countdown + the D-181 re-open routing
// decision (instant exam already submitted → result, NOT restart).

import { useCallback, useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useSession } from "@/features/auth/SessionProvider";
import type { ExamPreInfo } from "./types";

interface RawExam {
  id: string;
  title: string;
  starts_at: string;
  duration_min: number;
  result_release: "manual" | "instant";
  is_published: boolean;
  results_released_at: string | null;
  batch_id: string;
  exam_questions: Array<{ count: number }> | null;
  exam_attempts: Array<{
    id: string;
    submitted_at: string | null;
    student_id: string;
  }>;
}

interface State {
  data: ExamPreInfo | null;
  isLoading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

export function useExamPreInfo(examId: string | null): State {
  const { appUser } = useSession();
  const studentId = appUser?.id ?? null;
  const [data, setData] = useState<ExamPreInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!examId) return;
    setIsLoading(true);
    setError(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: row, error: err } = await supabase
        .from("exams")
        .select(
          "id, title, starts_at, duration_min, result_release, is_published, results_released_at, batch_id, exam_questions(count), exam_attempts(id, submitted_at, student_id)",
        )
        .eq("id", examId)
        .maybeSingle();
      if (err) {
        setError(err.message);
        return;
      }
      if (!row) {
        setError("Exam not visible to you.");
        return;
      }
      const r = row as unknown as RawExam;
      const mine =
        studentId != null
          ? r.exam_attempts?.find((a) => a.student_id === studentId) ?? null
          : null;
      setData({
        id: r.id,
        title: r.title,
        starts_at: r.starts_at,
        duration_min: r.duration_min,
        result_release: r.result_release,
        is_published: r.is_published,
        results_released_at: r.results_released_at,
        batch_id: r.batch_id,
        question_count: (r.exam_questions ?? [])[0]?.count ?? 0,
        existing_attempt: mine
          ? { id: mine.id, submitted_at: mine.submitted_at }
          : null,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load exam.");
    } finally {
      setIsLoading(false);
    }
  }, [examId, studentId]);

  useEffect(() => {
    if (examId) void reload();
  }, [examId, reload]);

  // Refetch on focus — picks up a teacher release while the tab was in the
  // background.
  useEffect(() => {
    if (!examId) return;
    const handler = () => {
      void reload();
    };
    window.addEventListener("focus", handler);
    return () => window.removeEventListener("focus", handler);
  }, [examId, reload]);

  return { data, isLoading, error, reload };
}
