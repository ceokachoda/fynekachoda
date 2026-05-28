"use client";

// Phase 4 Track 4B — teacher batch analytics (RPC `teacher_batch_overview`).
// Mirrors mobile features/dashboard/useTeacherBatchOverview.ts.

import { useQuery } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export interface BatchInfo {
  id: string;
  name: string;
  course_code: string;
  course_name: string;
  student_count: number;
}

export interface AttendanceDay {
  date: string;
  pct: number;
}

export interface TopicMastery {
  topic_id: string;
  topic_name: string;
  avg_mastery: number;
  student_count: number;
}

export interface AtRiskStudent {
  student_id: string;
  full_name: string;
  composite: number;
  avg_mastery: number | null;
  attendance_pct: number | null;
}

export interface BatchOverview {
  batch: BatchInfo | null;
  attendance: AttendanceDay[];
  topic_mastery: TopicMastery[];
  at_risk: AtRiskStudent[];
}

export function useTeacherBatchOverview(batchId: string | null | undefined) {
  return useQuery({
    queryKey: ["teacher-batch-overview", batchId],
    enabled: !!batchId,
    queryFn: async (): Promise<BatchOverview> => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase.rpc("teacher_batch_overview", {
        p_batch: batchId,
      });
      if (error) throw new Error(error.message);
      return data as unknown as BatchOverview;
    },
    staleTime: 60_000,
  });
}
