"use client";

// Phase 4 Track 4B — subjects belonging to the course of a given batch.
// Mirrors mobile features/exam/useBatchSubjects.

import { useQuery } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export interface SubjectOpt {
  id: string;
  name: string;
}

export function useBatchSubjects(batchId: string | null) {
  return useQuery({
    queryKey: ["batch-subjects", batchId],
    enabled: !!batchId,
    queryFn: async (): Promise<SubjectOpt[]> => {
      const supabase = createSupabaseBrowserClient();
      const bRes = await supabase
        .from("batches")
        .select("id, course_id")
        .eq("id", batchId)
        .maybeSingle();
      if (bRes.error || !bRes.data) {
        throw new Error(bRes.error?.message ?? "Batch not found.");
      }
      const courseId = (bRes.data as { course_id: string }).course_id;
      const sRes = await supabase
        .from("subjects")
        .select("id, name")
        .eq("course_id", courseId)
        .order("sort_order", { ascending: true });
      if (sRes.error) throw new Error(sRes.error.message);
      return ((sRes.data ?? []) as SubjectOpt[]).map((s) => ({
        id: s.id,
        name: s.name,
      }));
    },
    staleTime: 60_000 * 5,
  });
}
