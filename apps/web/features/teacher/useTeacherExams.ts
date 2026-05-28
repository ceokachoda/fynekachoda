"use client";

// Phase 4 Track 4B — list exams the teacher created OR in their assigned
// batches (RLS unions both — exams_teacher_read policy). Mirrors mobile
// useTeacherExams.

import { useQuery } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useSession } from "@/features/auth/SessionProvider";

export interface TeacherExamRow {
  id: string;
  title: string;
  batch_id: string;
  batch_name: string;
  starts_at: string;
  duration_min: number;
  is_published: boolean;
  results_released_at: string | null;
  result_release: "manual" | "instant";
  question_count: number;
  attempt_count: number;
}

export function useTeacherExams() {
  const { appUser } = useSession();
  const teacherId = appUser?.id;
  return useQuery({
    queryKey: ["teacher-exams", teacherId],
    enabled: !!teacherId,
    queryFn: async (): Promise<TeacherExamRow[]> => {
      const supabase = createSupabaseBrowserClient();
      const res = await supabase
        .from("exams")
        .select(
          "id, title, batch_id, starts_at, duration_min, is_published, results_released_at, result_release, batches!inner(name), exam_questions(count), exam_attempts(count)",
        )
        .order("starts_at", { ascending: false });
      if (res.error) throw new Error(res.error.message);
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
      return ((res.data ?? []) as unknown as Row[]).map((r) => ({
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
      }));
    },
    staleTime: 15_000,
  });
}
