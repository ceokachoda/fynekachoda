"use client";

import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/features/auth/SessionProvider";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export interface MasteryRow {
  topic_id: string;
  topic_name: string;
  mastery_pct: number;
  attempt_count: number;
  last_attempt_at: string | null;
}

interface RawMastery {
  topic_id: string;
  mastery_pct: number;
  attempt_count: number;
  last_attempt_at: string | null;
  topics: { name: string } | null;
}

export function useMastery() {
  const { appUser } = useSession();
  const studentId = appUser?.id;
  return useQuery<MasteryRow[]>({
    queryKey: ["mastery", studentId],
    enabled: !!studentId,
    staleTime: 60_000,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("mastery")
        .select(
          "topic_id, mastery_pct, attempt_count, last_attempt_at, topics(name)",
        )
        .eq("student_id", studentId!)
        .order("mastery_pct", { ascending: true });
      if (error) throw error;
      const rows = (data ?? []) as unknown as RawMastery[];
      return rows.map<MasteryRow>((r) => ({
        topic_id: r.topic_id,
        topic_name: r.topics?.name ?? "Unknown topic",
        mastery_pct: Number(r.mastery_pct ?? 0),
        attempt_count: Number(r.attempt_count ?? 0),
        last_attempt_at: r.last_attempt_at,
      }));
    },
  });
}

export function masteryColor(pct: number): string {
  if (pct < 50) return "#ef4444";
  if (pct < 75) return "#f59e0b";
  return "#10b981";
}
