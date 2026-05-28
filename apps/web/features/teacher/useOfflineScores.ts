"use client";

// Phase 4 Track 4B — roster + any existing scores for an offline test. Mirrors
// mobile useOfflineScores.ts.

import { useQuery } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

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

export function useOfflineScores(opts: {
  batchId: string | null;
  testName: string | null;
  testDate: string | null;
}) {
  const { batchId, testName, testDate } = opts;
  return useQuery({
    queryKey: ["offline-scores", batchId, testName ?? "", testDate ?? ""],
    enabled: !!batchId,
    queryFn: async (): Promise<{
      roster: BatchRosterStudent[];
      existing: OfflineScoreExisting[];
    }> => {
      const supabase = createSupabaseBrowserClient();
      const rRes = await supabase
        .from("students")
        .select("user_id, app_users!user_id(full_name)")
        .eq("batch_id", batchId)
        .order("user_id", { ascending: true });
      if (rRes.error) throw new Error(rRes.error.message);
      type RRow = {
        user_id: string;
        app_users: { full_name: string } | null;
      };
      const roster = ((rRes.data ?? []) as unknown as RRow[]).map((s) => ({
        student_id: s.user_id,
        full_name: s.app_users?.full_name ?? "(unknown)",
      }));
      let existing: OfflineScoreExisting[] = [];
      if (testName && testDate) {
        const eRes = await supabase
          .from("offline_test_scores")
          .select("id, student_id, score, notes")
          .eq("batch_id", batchId)
          .eq("test_name", testName)
          .eq("test_date", testDate);
        if (!eRes.error) {
          existing = (
            (eRes.data ?? []) as Array<{
              id: string;
              student_id: string;
              score: string | number;
              notes: string | null;
            }>
          ).map((e) => ({
            id: e.id,
            student_id: e.student_id,
            score: Number(e.score),
            notes: e.notes,
          }));
        }
      }
      return { roster, existing };
    },
    staleTime: 15_000,
  });
}
