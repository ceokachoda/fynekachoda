"use client";

// Phase 4 Track 4B — quiz builder loader. Hydrates either an empty draft (id
// === "new") or an existing quiz's full form + question list. Mirrors mobile
// features/quiz/useTeacherQuizBuilder.ts.

import { useQuery } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export interface BuilderQuizScope {
  topic_id: string | null;
  chapter_id: string | null;
  batch_id: string | null;
  course_id: string | null;
}

export interface BuilderQuizForm {
  id: string | null;
  title: string;
  scope: BuilderQuizScope;
  duration_min: number;
  marks_correct: number;
  marks_wrong: number;
  marks_skip: number;
  randomize_questions: boolean;
  randomize_options: boolean;
  is_published: boolean;
}

export interface BuilderQuizQuestion {
  question_id: string;
  sort_order: number;
  prompt_md: string;
}

interface QqRow {
  question_id: string;
  sort_order: number;
  questions: { id: string; prompt_md: string };
}

export const EMPTY_QUIZ_FORM: BuilderQuizForm = {
  id: null,
  title: "",
  scope: { topic_id: null, chapter_id: null, batch_id: null, course_id: null },
  duration_min: 20,
  marks_correct: 4,
  marks_wrong: -1,
  marks_skip: 0,
  randomize_questions: true,
  randomize_options: true,
  is_published: false,
};

export function useTeacherQuizBuilder(quizId: string | "new") {
  return useQuery({
    queryKey: ["teacher-quiz-builder", quizId],
    queryFn: async (): Promise<{
      quiz: BuilderQuizForm;
      questions: BuilderQuizQuestion[];
    }> => {
      if (quizId === "new") {
        return { quiz: EMPTY_QUIZ_FORM, questions: [] };
      }
      const supabase = createSupabaseBrowserClient();
      const res = await supabase
        .from("quizzes")
        .select(
          "id, title, topic_id, chapter_id, batch_id, course_id, duration_min, marks_correct, marks_wrong, marks_skip, randomize_questions, randomize_options, is_published",
        )
        .eq("id", quizId)
        .maybeSingle();
      if (res.error || !res.data) {
        throw new Error(res.error?.message ?? "Quiz not found.");
      }
      const r = res.data as Record<string, unknown>;
      const quiz: BuilderQuizForm = {
        id: r.id as string,
        title: r.title as string,
        scope: {
          topic_id: r.topic_id as string | null,
          chapter_id: r.chapter_id as string | null,
          batch_id: r.batch_id as string | null,
          course_id: r.course_id as string | null,
        },
        duration_min: r.duration_min as number,
        marks_correct: Number(r.marks_correct),
        marks_wrong: Number(r.marks_wrong),
        marks_skip: Number(r.marks_skip),
        randomize_questions: r.randomize_questions as boolean,
        randomize_options: r.randomize_options as boolean,
        is_published: r.is_published as boolean,
      };
      const qqRes = await supabase
        .from("quiz_questions")
        .select(
          "question_id, sort_order, questions!inner(id, prompt_md)",
        )
        .eq("quiz_id", quizId)
        .order("sort_order", { ascending: true });
      if (qqRes.error) throw new Error(qqRes.error.message);
      const questions: BuilderQuizQuestion[] = (
        (qqRes.data ?? []) as unknown as QqRow[]
      ).map((row) => ({
        question_id: row.question_id,
        sort_order: row.sort_order,
        prompt_md: row.questions.prompt_md,
      }));
      return { quiz, questions };
    },
  });
}
