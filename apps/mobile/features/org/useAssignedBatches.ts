import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/features/auth/useSession";
import { isNetworkError, NETWORK_ERROR_MESSAGE, withTimeout } from "@/features/auth/network-errors";
import { pickNextSession, type NextSession, type ScheduleRow } from "./schedule";

export type { NextSession } from "./schedule";

export interface AssignedBatch {
  batch_id: string;
  batch_name: string;
  course_code: string;
  course_name: string;
  student_count: number;
  next_session: NextSession | null;
}

interface State {
  data: AssignedBatch[] | null;
  error: string | null;
  isLoading: boolean;
  refresh: () => Promise<void>;
}

export function useAssignedBatches(): State {
  const { appUser, roles } = useSession();
  const isTeacher = roles.includes("teacher");
  const [data, setData] = useState<AssignedBatch[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const load = useCallback(async () => {
    if (!appUser?.id || !isTeacher) {
      setData(null);
      setError(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const { data: rows, error: dbErr } = await withTimeout(
        supabase
          .from("batches")
          .select(
            "id, name, is_active, courses(code, name), students(count), batch_schedule(weekday, start_time, end_time, is_active)",
          )
          .eq("is_active", true)
          .order("name", { ascending: true }),
      );
      if (dbErr) {
        setError(dbErr.message);
        setData(null);
        return;
      }
      const list = (rows ?? []) as unknown as RawBatch[];
      const mapped: AssignedBatch[] = list.map((b) => ({
        batch_id: b.id,
        batch_name: b.name,
        course_code: b.courses?.code ?? "—",
        course_name: b.courses?.name ?? "—",
        student_count: b.students?.[0]?.count ?? 0,
        next_session: pickNextSession(b.batch_schedule ?? []),
      }));
      setData(mapped);
    } catch (err) {
      setError(isNetworkError(err) ? NETWORK_ERROR_MESSAGE : "Couldn't load your batches.");
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [appUser?.id, isTeacher]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, error, isLoading, refresh: load };
}

interface RawBatch {
  id: string;
  name: string;
  is_active: boolean;
  courses: { code: string; name: string } | null;
  students: { count: number }[] | null;
  batch_schedule: ScheduleRow[] | null;
}
