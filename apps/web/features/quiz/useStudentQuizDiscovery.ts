"use client";

import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/features/auth/SessionProvider";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export interface DiscoverableQuiz {
  id: string;
  title: string;
  topic_id: string;
  chapter_id: string;
  duration_min: number;
  marks_correct: number;
  marks_wrong: number;
  marks_skip: number;
  attempt_count: number;
  best_score: number | null;
  best_max_score: number | null;
  last_submitted_at: string | null;
}

interface RawQuiz {
  id: string;
  title: string;
  topic_id: string;
  chapter_id: string;
  duration_min: number;
  marks_correct: number;
  marks_wrong: number;
  marks_skip: number;
}

interface RawAttempt {
  id: string;
  quiz_id: string;
  score: number | null;
  max_score: number | null;
  submitted_at: string | null;
}

export function useStudentQuizDiscovery() {
  const { appUser } = useSession();
  const studentId = appUser?.id;
  return useQuery({
    queryKey: ["quiz-discovery", studentId],
    enabled: !!studentId,
    staleTime: 60_000,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const [quizRes, attemptRes] = await Promise.all([
        supabase
          .from("quizzes")
          .select(
            "id, title, topic_id, chapter_id, duration_min, marks_correct, marks_wrong, marks_skip",
          )
          .eq("is_published", true)
          .order("created_at", { ascending: false }),
        supabase
          .from("quiz_attempts")
          .select("id, quiz_id, score, max_score, submitted_at")
          .not("submitted_at", "is", null)
          .order("submitted_at", { ascending: false }),
      ]);
      if (quizRes.error) throw quizRes.error;
      if (attemptRes.error) throw attemptRes.error;
      const quizzes = (quizRes.data ?? []) as RawQuiz[];
      const attempts = (attemptRes.data ?? []) as RawAttempt[];
      const byQuiz = new Map<
        string,
        { count: number; best: number | null; bestMax: number | null; lastAt: string | null }
      >();
      for (const a of attempts) {
        const cur = byQuiz.get(a.quiz_id) ?? {
          count: 0,
          best: null,
          bestMax: null,
          lastAt: null,
        };
        cur.count++;
        if (a.score != null && (cur.best == null || a.score > cur.best)) {
          cur.best = a.score;
          cur.bestMax = a.max_score;
        }
        if (!cur.lastAt || (a.submitted_at && a.submitted_at > cur.lastAt)) {
          cur.lastAt = a.submitted_at;
        }
        byQuiz.set(a.quiz_id, cur);
      }
      const list: DiscoverableQuiz[] = quizzes.map((q) => {
        const m = byQuiz.get(q.id);
        return {
          ...q,
          attempt_count: m?.count ?? 0,
          best_score: m?.best ?? null,
          best_max_score: m?.bestMax ?? null,
          last_submitted_at: m?.lastAt ?? null,
        };
      });
      const byTopic = new Map<string, DiscoverableQuiz[]>();
      for (const q of list) {
        const arr = byTopic.get(q.topic_id) ?? [];
        arr.push(q);
        byTopic.set(q.topic_id, arr);
      }
      return { list, byTopic };
    },
  });
}
