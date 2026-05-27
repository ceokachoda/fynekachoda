import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/features/auth/useSession";
import {
  isNetworkError,
  NETWORK_ERROR_MESSAGE,
  withTimeout,
} from "@/features/auth/network-errors";

export interface MasteryRow {
  topic_id: string;
  topic_name: string;
  mastery_pct: number;
  attempt_count: number;
  last_attempt_at: string | null;
}

interface State {
  rows: MasteryRow[];
  isLoading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

// Per-(student, topic) mastery breakdown (D-070 rolling-N), weakest first.
export function useMastery(): State {
  const { appUser } = useSession();
  const studentId = appUser?.id;
  const [rows, setRows] = useState<MasteryRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!studentId) {
      setRows([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const res = await withTimeout(
        supabase
          .from("mastery")
          .select("topic_id, mastery_pct, attempt_count, last_attempt_at, topics(name)")
          .eq("student_id", studentId)
          .order("mastery_pct", { ascending: true }),
      );
      if (res.error) {
        setError(res.error.message);
        return;
      }
      const data = (res.data ?? []) as unknown as Array<{
        topic_id: string;
        mastery_pct: number | string;
        attempt_count: number;
        last_attempt_at: string | null;
        topics: { name: string } | null;
      }>;
      setRows(
        data.map((r) => ({
          topic_id: r.topic_id,
          topic_name: r.topics?.name ?? "Topic",
          mastery_pct: Number(r.mastery_pct),
          attempt_count: r.attempt_count,
          last_attempt_at: r.last_attempt_at,
        })),
      );
    } catch (err) {
      setError(isNetworkError(err) ? NETWORK_ERROR_MESSAGE : "Couldn't load your mastery.");
    } finally {
      setIsLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { rows, isLoading, error, reload };
}
