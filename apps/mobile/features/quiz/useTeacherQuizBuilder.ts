import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { withTimeout } from "@/features/auth/network-errors";

export interface BuilderQuizScope {
  topic_id: string | null;
  chapter_id: string | null;
  batch_id: string | null;
  course_id: string | null;
}

export interface BuilderQuizForm {
  id: string | null; // null = new
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

export interface BuilderOptionForm {
  id?: string;
  text_md: string;
  image_path?: string | null;
  is_correct: boolean;
  sort_order: number;
}

export interface BuilderQuestionForm {
  id?: string;
  prompt_md: string;
  prompt_image_path?: string | null;
  difficulty: "easy" | "medium" | "hard" | null;
  topic_id: string;
  options: BuilderOptionForm[];
  explanation_md: string;
  related_content_id?: string | null;
}

interface BuilderState {
  quiz: BuilderQuizForm | null;
  questions: Array<{ question_id: string; sort_order: number; question: BuilderQuestionForm }>;
  isLoading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

export function useQuizBuilder(quizId: string | "new"): BuilderState {
  const [quiz, setQuiz] = useState<BuilderQuizForm | null>(null);
  const [questions, setQuestions] = useState<BuilderState["questions"]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (quizId === "new") {
      setQuiz({
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
      });
      setQuestions([]);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const res = await withTimeout(
        supabase
          .from("quizzes")
          .select(
            "id, title, topic_id, chapter_id, batch_id, course_id, duration_min, marks_correct, marks_wrong, marks_skip, randomize_questions, randomize_options, is_published",
          )
          .eq("id", quizId)
          .maybeSingle(),
      );
      if (res.error || !res.data) {
        setError(res.error?.message ?? "Quiz not found.");
        return;
      }
      const r = res.data as any;
      setQuiz({
        id: r.id,
        title: r.title,
        scope: {
          topic_id: r.topic_id,
          chapter_id: r.chapter_id,
          batch_id: r.batch_id,
          course_id: r.course_id,
        },
        duration_min: r.duration_min,
        marks_correct: Number(r.marks_correct),
        marks_wrong: Number(r.marks_wrong),
        marks_skip: Number(r.marks_skip),
        randomize_questions: r.randomize_questions,
        randomize_options: r.randomize_options,
        is_published: r.is_published,
      });

      const qqRes = await withTimeout(
        supabase
          .from("quiz_questions")
          .select(
            "question_id, sort_order, questions!inner(id, prompt_md, prompt_image_path, difficulty, topic_id, is_archived, question_options(id, text_md, image_path, is_correct, sort_order), question_solutions(question_id, explanation_md, related_content_id))",
          )
          .eq("quiz_id", quizId)
          .order("sort_order", { ascending: true }),
      );
      if (qqRes.error) {
        setError(qqRes.error.message);
        return;
      }
      const built = (qqRes.data ?? []).map((row: any) => {
        const q = row.questions;
        const sol = q.question_solutions?.[0] ?? null;
        return {
          question_id: q.id,
          sort_order: row.sort_order,
          question: {
            id: q.id,
            prompt_md: q.prompt_md,
            prompt_image_path: q.prompt_image_path,
            difficulty: q.difficulty,
            topic_id: q.topic_id,
            options: (q.question_options ?? []).map((o: any) => ({
              id: o.id,
              text_md: o.text_md,
              image_path: o.image_path,
              is_correct: o.is_correct,
              sort_order: o.sort_order,
            })),
            explanation_md: sol?.explanation_md ?? "",
            related_content_id: sol?.related_content_id ?? null,
          },
        };
      });
      setQuestions(built);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load quiz.");
    } finally {
      setIsLoading(false);
    }
  }, [quizId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { quiz, questions, isLoading, error, reload };
}
