import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  isNetworkError,
  NETWORK_ERROR_MESSAGE,
  withTimeout,
} from "@/features/auth/network-errors";
import { useSession } from "@/features/auth/useSession";
import type { TeacherExamRow } from "./types";

interface State {
  rows: TeacherExamRow[];
  isLoading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

export function useTeacherExams(): State {
  const { appUser } = useSession();
  const teacherId = appUser?.id;
  const [rows, setRows] = useState<TeacherExamRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!teacherId) return;
    setIsLoading(true);
    setError(null);
    try {
      // Read scope = exams created by THIS teacher OR in their assigned
      // batches. The exams_teacher_read policy unions both. We pull via a
      // straight SELECT — RLS handles the scope.
      const res = await withTimeout(
        supabase
          .from("exams")
          .select(
            "id, title, batch_id, starts_at, duration_min, is_published, results_released_at, result_release, batches!inner(name), exam_questions(count), exam_attempts(count)",
          )
          .order("starts_at", { ascending: false }),
      );
      if (res.error) {
        setError(res.error.message);
        return;
      }
      type Row = {
        id: string;
        title: string;
        batch_id: string;
        starts_at: string;
        duration_min: number;
        is_published: boolean;
        results_released_at: string | null;
        result_release: "manual" | "instant";
        batches: { name: string } | null;
        exam_questions: Array<{ count: number }>;
        exam_attempts: Array<{ count: number }>;
      };
      const mapped: TeacherExamRow[] = ((res.data ?? []) as unknown as Row[]).map(
        (r) => ({
          id: r.id,
          title: r.title,
          batch_id: r.batch_id,
          batch_name: r.batches?.name ?? "—",
          starts_at: r.starts_at,
          duration_min: r.duration_min,
          is_published: r.is_published,
          results_released_at: r.results_released_at,
          result_release: r.result_release,
          question_count: r.exam_questions?.[0]?.count ?? 0,
          attempt_count: r.exam_attempts?.[0]?.count ?? 0,
        }),
      );
      setRows(mapped);
    } catch (err) {
      setError(
        isNetworkError(err)
          ? NETWORK_ERROR_MESSAGE
          : "Couldn't load your exams.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [teacherId]);

  useEffect(() => {
    if (teacherId) void reload();
  }, [teacherId, reload]);

  return { rows, isLoading, error, reload };
}
