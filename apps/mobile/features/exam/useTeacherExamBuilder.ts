import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { withTimeout } from "@/features/auth/network-errors";

export interface BuilderExamForm {
  id: string | null;
  title: string;
  batch_id: string | null;
  starts_at: string | null; // ISO
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

interface State {
  exam: BuilderExamForm | null;
  questions: BuilderExamQuestion[];
  isLoading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

export function useExamBuilder(examId: string | "new"): State {
  const [exam, setExam] = useState<BuilderExamForm | null>(null);
  const [questions, setQuestions] = useState<BuilderExamQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (examId === "new") {
      setExam({
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
      });
      setQuestions([]);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const res = await withTimeout(
        supabase
          .from("exams")
          .select(
            "id, title, batch_id, starts_at, duration_min, marks_correct, marks_wrong, marks_skip, randomize_questions, randomize_options, result_release, is_published, results_released_at",
          )
          .eq("id", examId)
          .maybeSingle(),
      );
      if (res.error || !res.data) {
        setError(res.error?.message ?? "Exam not found.");
        return;
      }
      const r = res.data as Record<string, unknown>;
      setExam({
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
      });

      const qqRes = await withTimeout(
        supabase
          .from("exam_questions")
          .select(
            "question_id, sort_order, questions!inner(id, prompt_md, difficulty, topic_id, is_archived, question_options(id, is_correct))",
          )
          .eq("exam_id", examId)
          .order("sort_order", { ascending: true }),
      );
      if (qqRes.error) {
        setError(qqRes.error.message);
        return;
      }
      type Row = {
        question_id: string;
        sort_order: number;
        questions: {
          id: string;
          prompt_md: string;
          difficulty: "easy" | "medium" | "hard" | null;
          topic_id: string;
          is_archived: boolean;
          question_options: Array<{ id: string; is_correct: boolean }>;
        };
      };
      const built = ((qqRes.data ?? []) as unknown as Row[]).map((row) => ({
        question_id: row.question_id,
        sort_order: row.sort_order,
        prompt_md: row.questions.prompt_md,
        difficulty: row.questions.difficulty,
        topic_id: row.questions.topic_id,
        option_count: row.questions.question_options?.length ?? 0,
        has_correct:
          (row.questions.question_options ?? []).some((o) => o.is_correct),
      }));
      setQuestions(built);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load exam.");
    } finally {
      setIsLoading(false);
    }
  }, [examId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { exam, questions, isLoading, error, reload };
}
