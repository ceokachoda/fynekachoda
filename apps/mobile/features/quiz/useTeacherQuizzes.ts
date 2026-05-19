import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  isNetworkError,
  NETWORK_ERROR_MESSAGE,
  withTimeout,
} from "@/features/auth/network-errors";
import { useSession } from "@/features/auth/useSession";

export interface TeacherQuizRow {
  id: string;
  title: string;
  topic_id: string | null;
  chapter_id: string | null;
  batch_id: string | null;
  course_id: string;
  duration_min: number;
  is_published: boolean;
  created_at: string;
  question_count: number;
}

interface State {
  rows: TeacherQuizRow[];
  isLoading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

export function useTeacherQuizzes(): State {
  const { appUser } = useSession();
  const teacherId = appUser?.id;
  const [rows, setRows] = useState<TeacherQuizRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!teacherId) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await withTimeout(
        supabase
          .from("quizzes")
          .select(
            "id, title, topic_id, chapter_id, batch_id, course_id, duration_min, is_published, created_at, quiz_questions(count)",
          )
          .eq("created_by", teacherId)
          .order("created_at", { ascending: false }),
      );
      if (res.error) {
        setError(res.error.message);
        return;
      }
      const mapped = (res.data ?? []).map((r: any) => ({
        ...r,
        question_count: r.quiz_questions?.[0]?.count ?? 0,
      })) as TeacherQuizRow[];
      setRows(mapped);
    } catch (err) {
      setError(
        isNetworkError(err)
          ? NETWORK_ERROR_MESSAGE
          : "Couldn't load your quizzes.",
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
