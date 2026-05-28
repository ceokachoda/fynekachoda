"use client";

import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/features/auth/SessionProvider";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export type ExamStatus =
  | "upcoming"
  | "live"
  | "scheduled"
  | "submitted"
  | "results_pending"
  | "results_released"
  | "ended";

export interface StudentExamRow {
  id: string;
  title: string;
  starts_at: string;
  duration_min: number;
  is_published: boolean;
  results_released_at: string | null;
  result_release: "manual" | "instant";
  attempt: {
    id: string;
    submitted_at: string | null;
    score: number | null;
    max_score: number | null;
  } | null;
  status: ExamStatus;
}

interface RawExam {
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
}

export function computeStatus(
  exam: RawExam,
  studentId: string,
  now: number = Date.now(),
): ExamStatus {
  const start = new Date(exam.starts_at).getTime();
  const end = start + exam.duration_min * 60 * 1000;
  const myAttempt = exam.exam_attempts?.find((a) => a.student_id === studentId);
  if (myAttempt?.submitted_at) {
    if (exam.result_release === "instant" || exam.results_released_at) {
      return "results_released";
    }
    return "results_pending";
  }
  if (now < start) return "scheduled";
  if (now >= start && now <= end) return "live";
  return "ended";
}

export function useStudentExams() {
  const { appUser } = useSession();
  const studentId = appUser?.id;
  return useQuery<StudentExamRow[]>({
    queryKey: ["student-exams", studentId],
    enabled: !!studentId,
    staleTime: 30_000,
    // Hard guard against any 'is_correct' / question_bank leak — this query
    // SELECTS specifically by column name; it does not read `questions` or
    // `correct_option_id`. If anyone widens the select(), CI should catch it.
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("exams")
        .select(
          "id, title, starts_at, duration_min, is_published, results_released_at, result_release, exam_attempts(id, submitted_at, score, max_score, student_id)",
        )
        .eq("is_published", true)
        .order("starts_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      const rows = (data ?? []) as unknown as RawExam[];
      const now = Date.now();
      return rows.map<StudentExamRow>((e) => {
        const myAttempt =
          e.exam_attempts?.find((a) => a.student_id === studentId) ?? null;
        return {
          id: e.id,
          title: e.title,
          starts_at: e.starts_at,
          duration_min: e.duration_min,
          is_published: e.is_published,
          results_released_at: e.results_released_at,
          result_release: e.result_release,
          attempt: myAttempt
            ? {
                id: myAttempt.id,
                submitted_at: myAttempt.submitted_at,
                score: myAttempt.score,
                max_score: myAttempt.max_score,
              }
            : null,
          status: computeStatus(e, studentId!, now),
        };
      });
    },
  });
}
