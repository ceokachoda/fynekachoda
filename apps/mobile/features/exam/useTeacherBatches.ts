import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { withTimeout } from "@/features/auth/network-errors";
import { useSession } from "@/features/auth/useSession";

export interface TeacherBatchOpt {
  batch_id: string;
  batch_name: string;
  course_id: string;
  course_code: string;
}

interface State {
  batches: TeacherBatchOpt[];
  isLoading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

export function useTeacherBatches(): State {
  const { appUser } = useSession();
  const teacherId = appUser?.id;
  const [batches, setBatches] = useState<TeacherBatchOpt[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!teacherId) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await withTimeout(
        supabase
          .from("batch_teachers")
          .select(
            "batch_id, batches!inner(id, name, course_id, courses!inner(code))",
          )
          .eq("teacher_id", teacherId),
      );
      if (res.error) {
        setError(res.error.message);
        return;
      }
      type Row = {
        batch_id: string;
        batches: {
          id: string;
          name: string;
          course_id: string;
          courses: { code: string };
        };
      };
      const mapped: TeacherBatchOpt[] = ((res.data ?? []) as unknown as Row[]).map(
        (r) => ({
          batch_id: r.batch_id,
          batch_name: r.batches.name,
          course_id: r.batches.course_id,
          course_code: r.batches.courses.code,
        }),
      );
      setBatches(mapped);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load batches.");
    } finally {
      setIsLoading(false);
    }
  }, [teacherId]);

  useEffect(() => {
    if (teacherId) void reload();
  }, [teacherId, reload]);

  return { batches, isLoading, error, reload };
}
