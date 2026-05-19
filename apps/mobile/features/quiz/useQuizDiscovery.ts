import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  isNetworkError,
  NETWORK_ERROR_MESSAGE,
  withTimeout,
} from "@/features/auth/network-errors";

export interface DiscoverableQuiz {
  id: string;
  title: string;
  topic_id: string | null;
  chapter_id: string | null;
  duration_min: number;
  marks_correct: number;
  marks_wrong: number;
  marks_skip: number;
  // student-facing: number of times THIS student has attempted (server RLS
  // already filters to own attempts).
  attempt_count: number;
  best_score: number | null;
  best_max_score: number | null;
  last_submitted_at: string | null;
}

interface State {
  byTopic: Map<string, DiscoverableQuiz[]>;
  list: DiscoverableQuiz[];
  isLoading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

// Lists every published quiz the student can see (RLS scopes to course +
// batch), augmented with the student's own attempt summary so the library
// can show "attempted 3x, best 92%".
export function useStudentQuizDiscovery(): State {
  const [list, setList] = useState<DiscoverableQuiz[]>([]);
  const [byTopic, setByTopic] = useState<Map<string, DiscoverableQuiz[]>>(
    new Map(),
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const quizRes = await withTimeout(
        supabase
          .from("quizzes")
          .select(
            "id, title, topic_id, chapter_id, duration_min, marks_correct, marks_wrong, marks_skip",
          )
          .eq("is_published", true)
          .order("created_at", { ascending: false }),
      );
      if (quizRes.error) {
        setError(quizRes.error.message);
        setList([]);
        setByTopic(new Map());
        return;
      }
      const quizzes = (quizRes.data ?? []) as DiscoverableQuiz[];

      const attemptsRes = await withTimeout(
        supabase
          .from("quiz_attempts")
          .select("id, quiz_id, score, max_score, submitted_at")
          .not("submitted_at", "is", null)
          .order("submitted_at", { ascending: false }),
      );
      const attemptByQuiz = new Map<
        string,
        { count: number; bestScore: number | null; bestMax: number | null; last: string | null }
      >();
      for (const a of attemptsRes.data ?? []) {
        const slot = attemptByQuiz.get(a.quiz_id) ?? {
          count: 0,
          bestScore: null,
          bestMax: null,
          last: null,
        };
        slot.count += 1;
        const score = a.score === null ? null : Number(a.score);
        const max = a.max_score === null ? null : Number(a.max_score);
        if (score !== null && max !== null) {
          if (slot.bestScore === null || score / max > (slot.bestScore / (slot.bestMax || 1))) {
            slot.bestScore = score;
            slot.bestMax = max;
          }
        }
        if (!slot.last && a.submitted_at) slot.last = a.submitted_at;
        attemptByQuiz.set(a.quiz_id, slot);
      }

      const enriched: DiscoverableQuiz[] = quizzes.map((q) => {
        const slot = attemptByQuiz.get(q.id);
        return {
          ...q,
          marks_correct: Number(q.marks_correct),
          marks_wrong: Number(q.marks_wrong),
          marks_skip: Number(q.marks_skip),
          attempt_count: slot?.count ?? 0,
          best_score: slot?.bestScore ?? null,
          best_max_score: slot?.bestMax ?? null,
          last_submitted_at: slot?.last ?? null,
        };
      });

      const map = new Map<string, DiscoverableQuiz[]>();
      for (const q of enriched) {
        if (!q.topic_id) continue;
        const list = map.get(q.topic_id) ?? [];
        list.push(q);
        map.set(q.topic_id, list);
      }
      setList(enriched);
      setByTopic(map);
    } catch (err) {
      setError(
        isNetworkError(err)
          ? NETWORK_ERROR_MESSAGE
          : "Couldn't load quizzes.",
      );
      setList([]);
      setByTopic(new Map());
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { byTopic, list, isLoading, error, reload };
}
