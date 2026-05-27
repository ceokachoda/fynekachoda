import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/features/auth/useSession";
import {
  isNetworkError,
  NETWORK_ERROR_MESSAGE,
  withTimeout,
} from "@/features/auth/network-errors";
import type { StudentDashboard } from "./types";

interface State {
  data: StudentDashboard | null;
  isLoading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

// One round-trip to the public.student_dashboard(p_student) SQL fn (Phase 8).
// The fn coalesces every slice, so `data` is always well-formed once loaded.
export function useStudentDashboard(): State {
  const { appUser } = useSession();
  const studentId = appUser?.id;
  const [data, setData] = useState<StudentDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!studentId) {
      setData(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const res = await withTimeout(
        supabase.rpc("student_dashboard", { p_student: studentId }),
      );
      if (res.error) {
        setError(res.error.message);
        return;
      }
      setData(res.data as unknown as StudentDashboard);
    } catch (err) {
      setError(
        isNetworkError(err) ? NETWORK_ERROR_MESSAGE : "Couldn't load your dashboard.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, isLoading, error, reload };
}
