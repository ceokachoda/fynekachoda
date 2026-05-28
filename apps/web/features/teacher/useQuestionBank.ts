"use client";

// Phase 4 Track 4B — question bank list for builders (filter by topic +
// optional search). Mirrors mobile features/quiz/useQuestionBank.ts.

import { useQuery } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export interface QuestionBankItem {
  id: string;
  topic_id: string;
  prompt_md: string;
  difficulty: "easy" | "medium" | "hard" | null;
  is_archived: boolean;
  option_count: number;
}

export interface QuestionBankFilters {
  topic_id?: string | null;
  difficulty?: "easy" | "medium" | "hard" | null;
  search?: string;
}

export function useQuestionBank(filters: QuestionBankFilters = {}) {
  return useQuery({
    queryKey: [
      "question-bank",
      filters.topic_id ?? null,
      filters.difficulty ?? null,
      filters.search ?? "",
    ],
    queryFn: async (): Promise<QuestionBankItem[]> => {
      const supabase = createSupabaseBrowserClient();
      let query = supabase
        .from("questions")
        .select(
          "id, topic_id, prompt_md, difficulty, is_archived, question_options(count)",
        )
        .eq("is_archived", false)
        .order("created_at", { ascending: false })
        .limit(200);
      if (filters.topic_id) query = query.eq("topic_id", filters.topic_id);
      if (filters.difficulty) query = query.eq("difficulty", filters.difficulty);
      if (filters.search && filters.search.trim().length > 0) {
        query = query.ilike("prompt_md", `%${filters.search.trim()}%`);
      }
      const res = await query;
      if (res.error) throw new Error(res.error.message);
      type Row = QuestionBankItem & {
        question_options: Array<{ count: number }>;
      };
      return ((res.data ?? []) as unknown as Row[]).map((r) => ({
        id: r.id,
        topic_id: r.topic_id,
        prompt_md: r.prompt_md,
        difficulty: r.difficulty,
        is_archived: r.is_archived,
        option_count: r.question_options?.[0]?.count ?? 0,
      }));
    },
    staleTime: 30_000,
  });
}
