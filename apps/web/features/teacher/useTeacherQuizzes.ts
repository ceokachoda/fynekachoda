"use client";

// Phase 4 Track 4B — teacher's own quizzes for the /quizzes list. Mirrors
// mobile features/quiz/useTeacherQuizzes.ts.

import { useQuery } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useSession } from "@/features/auth/SessionProvider";

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

export function useTeacherQuizzes() {
  const { appUser } = useSession();
  const teacherId = appUser?.id;
  return useQuery({
    queryKey: ["teacher-quizzes", teacherId],
    enabled: !!teacherId,
    queryFn: async (): Promise<TeacherQuizRow[]> => {
      const supabase = createSupabaseBrowserClient();
      const res = await supabase
        .from("quizzes")
        .select(
          "id, title, topic_id, chapter_id, batch_id, course_id, duration_min, is_published, created_at, quiz_questions(count)",
        )
        .eq("created_by", teacherId)
        .order("created_at", { ascending: false });
      if (res.error) throw new Error(res.error.message);
      type Row = TeacherQuizRow & {
        quiz_questions: Array<{ count: number }>;
      };
      return ((res.data ?? []) as unknown as Row[]).map((r) => ({
        id: r.id,
        title: r.title,
        topic_id: r.topic_id,
        chapter_id: r.chapter_id,
        batch_id: r.batch_id,
        course_id: r.course_id,
        duration_min: r.duration_min,
        is_published: r.is_published,
        created_at: r.created_at,
        question_count: r.quiz_questions?.[0]?.count ?? 0,
      }));
    },
    staleTime: 15_000,
  });
}
