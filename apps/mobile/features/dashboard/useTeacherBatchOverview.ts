import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  isNetworkError,
  NETWORK_ERROR_MESSAGE,
  withTimeout,
} from "@/features/auth/network-errors";

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

interface State {
  data: BatchOverview | null;
  isLoading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

export function useTeacherBatchOverview(batchId: string): State {
  const [data, setData] = useState<BatchOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!batchId) {
      setData(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const res = await withTimeout(
        supabase.rpc("teacher_batch_overview", { p_batch: batchId }),
      );
      if (res.error) {
        setError(res.error.message);
        return;
      }
      setData(res.data as unknown as BatchOverview);
    } catch (err) {
      setError(isNetworkError(err) ? NETWORK_ERROR_MESSAGE : "Couldn't load batch analytics.");
    } finally {
      setIsLoading(false);
    }
  }, [batchId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, isLoading, error, reload };
}
