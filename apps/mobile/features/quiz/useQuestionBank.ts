import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  isNetworkError,
  NETWORK_ERROR_MESSAGE,
  withTimeout,
} from "@/features/auth/network-errors";

export interface QuestionBankItem {
  id: string;
  topic_id: string;
  prompt_md: string;
  difficulty: "easy" | "medium" | "hard" | null;
  is_archived: boolean;
  option_count: number;
}

interface Filters {
  topic_id?: string | null;
  difficulty?: "easy" | "medium" | "hard" | null;
  search?: string;
}

interface State {
  rows: QuestionBankItem[];
  isLoading: boolean;
  error: string | null;
  reload: (filters?: Filters) => Promise<void>;
}

export function useQuestionBank(initial: Filters = {}): State {
  const [filters, setFilters] = useState<Filters>(initial);
  const [rows, setRows] = useState<QuestionBankItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async (next?: Filters) => {
    if (next) setFilters(next);
    const f = next ?? filters;
    setIsLoading(true);
    setError(null);
    try {
      let query = supabase
        .from("questions")
        .select(
          "id, topic_id, prompt_md, difficulty, is_archived, question_options(count)",
        )
        .eq("is_archived", false)
        .order("created_at", { ascending: false })
        .limit(200);
      if (f.topic_id) query = query.eq("topic_id", f.topic_id);
      if (f.difficulty) query = query.eq("difficulty", f.difficulty);
      if (f.search && f.search.trim().length > 0) {
        query = query.ilike("prompt_md", `%${f.search.trim()}%`);
      }
      const res = await withTimeout(query);
      if (res.error) {
        setError(res.error.message);
        setRows([]);
        return;
      }
      const mapped = (res.data ?? []).map((r: any) => ({
        id: r.id,
        topic_id: r.topic_id,
        prompt_md: r.prompt_md,
        difficulty: r.difficulty,
        is_archived: r.is_archived,
        option_count: r.question_options?.[0]?.count ?? 0,
      })) as QuestionBankItem[];
      setRows(mapped);
    } catch (err) {
      setError(
        isNetworkError(err)
          ? NETWORK_ERROR_MESSAGE
          : "Couldn't load question bank.",
      );
      setRows([]);
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void reload(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { rows, isLoading, error, reload };
}
