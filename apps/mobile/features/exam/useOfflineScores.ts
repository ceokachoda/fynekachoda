import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { withTimeout } from "@/features/auth/network-errors";

export interface BatchRosterStudent {
  student_id: string;
  full_name: string;
}

export interface OfflineScoreExisting {
  id: string;
  student_id: string;
  score: number;
  notes: string | null;
}

interface State {
  roster: BatchRosterStudent[];
  existing: OfflineScoreExisting[];
  isLoading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

export function useOfflineScores(opts: {
  batchId: string | null;
  testName: string | null;
  testDate: string | null; // YYYY-MM-DD
}): State {
  const { batchId, testName, testDate } = opts;
  const [roster, setRoster] = useState<BatchRosterStudent[]>([]);
  const [existing, setExisting] = useState<OfflineScoreExisting[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!batchId) {
      setRoster([]);
      setExisting([]);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const rRes = await withTimeout(
        supabase
          .from("students")
          .select("user_id, app_users!user_id(full_name)")
          .eq("batch_id", batchId)
          .order("user_id", { ascending: true }),
      );
      if (rRes.error) {
        setError(rRes.error.message);
        return;
      }
      type RRow = {
        user_id: string;
        app_users: { full_name: string } | null;
      };
      const mappedRoster = ((rRes.data ?? []) as unknown as RRow[]).map(
        (s) => ({
          student_id: s.user_id,
          full_name: s.app_users?.full_name ?? "(unknown)",
        }),
      );
      setRoster(mappedRoster);

      if (testName && testDate) {
        const eRes = await withTimeout(
          supabase
            .from("offline_test_scores")
            .select("id, student_id, score, notes")
            .eq("batch_id", batchId)
            .eq("test_name", testName)
            .eq("test_date", testDate),
        );
        if (!eRes.error) {
          setExisting(
            ((eRes.data ?? []) as Array<{
              id: string;
              student_id: string;
              score: string | number;
              notes: string | null;
            }>).map((e) => ({
              id: e.id,
              student_id: e.student_id,
              score: Number(e.score),
              notes: e.notes,
            })),
          );
        }
      } else {
        setExisting([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load roster.");
    } finally {
      setIsLoading(false);
    }
  }, [batchId, testName, testDate]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { roster, existing, isLoading, error, reload };
}
