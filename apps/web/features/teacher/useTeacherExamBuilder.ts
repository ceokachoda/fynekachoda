"use client";

// Phase 4 Track 4B — exam builder loader (mirrors mobile useExamBuilder).

import { useQuery } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export interface BuilderExamForm {
  id: string | null;
  title: string;
  batch_id: string | null;
  starts_at: string | null;
  duration_min: number;
  marks_correct: number;
  marks_wrong: number;
  marks_skip: number;
  randomize_questions: boolean;
  randomize_options: boolean;
  result_release: "manual" | "instant";
  is_published: boolean;
  results_released_at: string | null;
}

export interface BuilderExamQuestion {
  question_id: string;
  sort_order: number;
  prompt_md: string;
  difficulty: "easy" | "medium" | "hard" | null;
  topic_id: string;
  option_count: number;
  has_correct: boolean;
}

export const EMPTY_EXAM_FORM: BuilderExamForm = {
  id: null,
  title: "",
  batch_id: null,
  starts_at: null,
  duration_min: 60,
  marks_correct: 4,
  marks_wrong: -1,
  marks_skip: 0,
  randomize_questions: true,
  randomize_options: true,
  result_release: "manual",
  is_published: false,
  results_released_at: null,
};

export function useTeacherExamBuilder(examId: string | "new") {
  return useQuery({
    queryKey: ["teacher-exam-builder", examId],
    queryFn: async (): Promise<{
      exam: BuilderExamForm;
      questions: BuilderExamQuestion[];
    }> => {
      if (examId === "new") {
        return { exam: EMPTY_EXAM_FORM, questions: [] };
      }
      const supabase = createSupabaseBrowserClient();
      const res = await supabase
        .from("exams")
        .select(
          "id, title, batch_id, starts_at, duration_min, marks_correct, marks_wrong, marks_skip, randomize_questions, randomize_options, result_release, is_published, results_released_at",
        )
        .eq("id", examId)
        .maybeSingle();
      if (res.error || !res.data) {
        throw new Error(res.error?.message ?? "Exam not found.");
      }
      const r = res.data as Record<string, unknown>;
      const exam: BuilderExamForm = {
        id: r.id as string,
        title: r.title as string,
        batch_id: r.batch_id as string | null,
        starts_at: r.starts_at as string,
        duration_min: r.duration_min as number,
        marks_correct: Number(r.marks_correct),
        marks_wrong: Number(r.marks_wrong),
        marks_skip: Number(r.marks_skip),
        randomize_questions: r.randomize_questions as boolean,
        randomize_options: r.randomize_options as boolean,
        result_release: r.result_release as "manual" | "instant",
        is_published: r.is_published as boolean,
        results_released_at: r.results_released_at as string | null,
      };
      const qqRes = await supabase
        .from("exam_questions")
        .select(
          "question_id, sort_order, questions!inner(id, prompt_md, difficulty, topic_id, question_options(id, is_correct))",
        )
        .eq("exam_id", examId)
        .order("sort_order", { ascending: true });
      if (qqRes.error) throw new Error(qqRes.error.message);
      type Row = {
        question_id: string;
        sort_order: number;
        questions: {
          id: string;
          prompt_md: string;
          difficulty: "easy" | "medium" | "hard" | null;
          topic_id: string;
          question_options: Array<{ id: string; is_correct: boolean }>;
        };
      };
      const questions: BuilderExamQuestion[] = (
        (qqRes.data ?? []) as unknown as Row[]
      ).map((row) => ({
        question_id: row.question_id,
        sort_order: row.sort_order,
        prompt_md: row.questions.prompt_md,
        difficulty: row.questions.difficulty,
        topic_id: row.questions.topic_id,
        option_count: row.questions.question_options?.length ?? 0,
        has_correct:
          (row.questions.question_options ?? []).some((o) => o.is_correct),
      }));
      return { exam, questions };
    },
  });
}
