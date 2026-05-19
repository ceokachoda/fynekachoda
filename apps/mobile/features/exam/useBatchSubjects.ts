import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { withTimeout } from "@/features/auth/network-errors";

export interface SubjectOpt {
  id: string;
  name: string;
}

interface State {
  subjects: SubjectOpt[];
  isLoading: boolean;
  error: string | null;
}

// Returns the subjects belonging to the course of the given batch.
export function useBatchSubjects(batchId: string | null): State {
  const [subjects, setSubjects] = useState<SubjectOpt[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!batchId) {
      setSubjects([]);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const bRes = await withTimeout(
        supabase
          .from("batches")
          .select("id, course_id")
          .eq("id", batchId)
          .maybeSingle(),
      );
      if (bRes.error || !bRes.data) {
        setError(bRes.error?.message ?? "Batch not found.");
        return;
      }
      const courseId = (bRes.data as { course_id: string }).course_id;
      const sRes = await withTimeout(
        supabase
          .from("subjects")
          .select("id, name")
          .eq("course_id", courseId)
          .order("sort_order", { ascending: true }),
      );
      if (sRes.error) {
        setError(sRes.error.message);
        return;
      }
      setSubjects(
        ((sRes.data ?? []) as SubjectOpt[]).map((s) => ({ id: s.id, name: s.name })),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load subjects.");
    } finally {
      setIsLoading(false);
    }
  }, [batchId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { subjects, isLoading, error };
}
