import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  isNetworkError,
  NETWORK_ERROR_MESSAGE,
  withTimeout,
} from "@/features/auth/network-errors";
import { useSession } from "@/features/auth/useSession";
import type { StudentExamRow } from "./types";

interface State {
  rows: StudentExamRow[];
  isLoading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

export function useStudentExams(): State {
  const { appUser } = useSession();
  const studentId = appUser?.id;
  const [rows, setRows] = useState<StudentExamRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!studentId) return;
    setIsLoading(true);
    setError(null);
    try {
      // RLS scopes to student's batch. We also embed any pre-existing
      // attempt (exam_attempts_student_read) so the UI can show
      // submitted/score/etc.
      const res = await withTimeout(
        supabase
          .from("exams")
          .select(
            "id, title, starts_at, duration_min, is_published, results_released_at, result_release, exam_attempts(id, submitted_at, score, max_score, student_id)",
          )
          .eq("is_published", true)
          .order("starts_at", { ascending: false })
          .limit(100),
      );
      if (res.error) {
        setError(res.error.message);
        return;
      }
      type Row = {
        id: string;
        title: string;
        starts_at: string;
        duration_min: number;
        is_published: boolean;
        results_released_at: string | null;
        result_release: "manual" | "instant";
        exam_attempts: Array<{
          id: string;
          submitted_at: string | null;
          score: number | null;
          max_score: number | null;
          student_id: string;
        }>;
      };
      const mapped: StudentExamRow[] = ((res.data ?? []) as unknown as Row[]).map(
        (r) => {
          const mine = (r.exam_attempts ?? []).find(
            (a) => a.student_id === studentId,
          );
          return {
            id: r.id,
            title: r.title,
            starts_at: r.starts_at,
            duration_min: r.duration_min,
            is_published: r.is_published,
            results_released_at: r.results_released_at,
            result_release: r.result_release,
            attempt: mine
              ? {
                  id: mine.id,
                  submitted_at: mine.submitted_at,
                  score: mine.score !== null ? Number(mine.score) : null,
                  max_score:
                    mine.max_score !== null ? Number(mine.max_score) : null,
                }
              : undefined,
          };
        },
      );
      setRows(mapped);
    } catch (e) {
      setError(
        isNetworkError(e) ? NETWORK_ERROR_MESSAGE : "Couldn't load exams.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    if (studentId) void reload();
  }, [studentId, reload]);

  return { rows, isLoading, error, reload };
}
