import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { withTimeout } from "@/features/auth/network-errors";
import { useSession } from "@/features/auth/useSession";

export interface WeakTopic {
  topic_id: string;
  topic_name: string;
  attempts: number;
  score_pct: number;
  suggested_quiz_id: string;
  suggested_quiz_title: string;
}

interface State {
  rows: WeakTopic[];
  isLoading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

// Phase 6 proxy for mastery (D-070 lands in Phase 8). Groups submitted quiz
// attempts by `quizzes.topic_id` and returns topics where the student's BEST
// score % is below threshold. Best (not average) so that once a student
// demonstrates ≥threshold on a topic the nudge clears — matches the student-
// facing "you've shown you can do this" mental model (Phase 8's mastery table
// will use the weighted average per spec §6.3). The "suggested quiz" is the
// most-recent PUBLISHED quiz on that topic the student can currently see (RLS
// scopes the quizzes query for us).
export function useWeakTopics(threshold = 70): State {
  const { appUser } = useSession();
  const [rows, setRows] = useState<WeakTopic[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!appUser?.id) return;
    setIsLoading(true);
    setError(null);
    try {
      const attempts = await withTimeout(
        supabase
          .from("quiz_attempts")
          .select(
            "id, quiz_id, score, max_score, submitted_at, quizzes!inner(id, title, topic_id, is_published, topics:topic_id(id, name))",
          )
          .eq("student_id", appUser.id)
          .not("submitted_at", "is", null)
          .order("submitted_at", { ascending: false })
          .limit(200),
      );
      if (attempts.error) {
        setError(attempts.error.message);
        setRows([]);
        return;
      }
      type Row = {
        score: number | null;
        max_score: number | null;
        submitted_at: string | null;
        quizzes: {
          id: string;
          title: string;
          topic_id: string | null;
          is_published: boolean;
          topics: { id: string; name: string } | null;
        } | null;
      };
      const ar = (attempts.data ?? []) as unknown as Row[];

      // Aggregate per topic — track the BEST score % seen so far.
      const byTopic = new Map<
        string,
        {
          topic_name: string;
          best_pct: number;
          n: number;
          latest_quiz_id: string;
          latest_quiz_title: string;
          latest_submitted_at: string;
        }
      >();
      for (const a of ar) {
        const q = a.quizzes;
        if (!q || !q.topic_id) continue;
        const score = a.score === null ? null : Number(a.score);
        const max = a.max_score === null ? null : Number(a.max_score);
        if (score === null || max === null || max <= 0) continue;
        const pct = (score / max) * 100;
        const topicId = q.topic_id;
        const topicName = q.topics?.name ?? "Topic";
        const cur = byTopic.get(topicId);
        if (!cur) {
          byTopic.set(topicId, {
            topic_name: topicName,
            best_pct: pct,
            n: 1,
            latest_quiz_id: q.id,
            latest_quiz_title: q.title,
            latest_submitted_at: a.submitted_at!,
          });
        } else {
          cur.n += 1;
          if (pct > cur.best_pct) cur.best_pct = pct;
          if (a.submitted_at! > cur.latest_submitted_at) {
            cur.latest_quiz_id = q.id;
            cur.latest_quiz_title = q.title;
            cur.latest_submitted_at = a.submitted_at!;
          }
        }
      }

      const weak: WeakTopic[] = [];
      for (const [topicId, v] of byTopic) {
        if (v.best_pct < threshold) {
          weak.push({
            topic_id: topicId,
            topic_name: v.topic_name,
            attempts: v.n,
            // Negative marking can drive a raw score below 0; the nudge badge
            // shows 0% rather than a confusing "-25%". Threshold check above
            // still uses the true best_pct.
            score_pct: Math.max(0, Math.round(v.best_pct)),
            suggested_quiz_id: v.latest_quiz_id,
            suggested_quiz_title: v.latest_quiz_title,
          });
        }
      }
      weak.sort((a, b) => a.score_pct - b.score_pct);
      setRows(weak.slice(0, 5));
    } catch (err) {
      setError(err instanceof Error ? err.message : "load failed");
      setRows([]);
    } finally {
      setIsLoading(false);
    }
  }, [appUser?.id, threshold]);

  useEffect(() => {
    if (appUser?.id) void reload();
  }, [appUser?.id, reload]);

  return { rows, isLoading, error, reload };
}
