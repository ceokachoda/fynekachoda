import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/features/auth/useSession";
import {
  isNetworkError,
  NETWORK_ERROR_MESSAGE,
  withTimeout,
} from "@/features/auth/network-errors";

export interface StreakDetail {
  activeDays: string[]; // YYYY-MM-DD (IST) the student had a qualifying action
  currentDays: number;
  bestDays: number;
  lastActive: string | null;
}

interface State {
  data: StreakDetail | null;
  isLoading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

export function useStreak(): State {
  const { appUser } = useSession();
  const studentId = appUser?.id;
  const [data, setData] = useState<StreakDetail | null>(null);
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
      const [actRes, strRes] = await Promise.all([
        withTimeout(
          supabase
            .from("activity_days")
            .select("day")
            .eq("student_id", studentId)
            .order("day", { ascending: false })
            .limit(120),
        ),
        withTimeout(
          supabase
            .from("streaks")
            .select("current_days, best_days, last_active")
            .eq("student_id", studentId)
            .maybeSingle(),
        ),
      ]);
      if (actRes.error) {
        setError(actRes.error.message);
        return;
      }
      const activeDays = ((actRes.data ?? []) as Array<{ day: string }>).map((r) => r.day);
      const str = (strRes.data ?? null) as
        | { current_days: number; best_days: number; last_active: string | null }
        | null;
      setData({
        activeDays,
        currentDays: str?.current_days ?? 0,
        bestDays: str?.best_days ?? 0,
        lastActive: str?.last_active ?? null,
      });
    } catch (err) {
      setError(isNetworkError(err) ? NETWORK_ERROR_MESSAGE : "Couldn't load your streak.");
    } finally {
      setIsLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, isLoading, error, reload };
}
