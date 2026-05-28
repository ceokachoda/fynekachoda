"use client";

import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/features/auth/SessionProvider";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export interface StreakDetail {
  activeDays: string[];
  currentDays: number;
  bestDays: number;
}

export function useStreak() {
  const { appUser } = useSession();
  const studentId = appUser?.id;
  return useQuery<StreakDetail>({
    queryKey: ["streak", studentId],
    enabled: !!studentId,
    staleTime: 60_000,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const [activityRes, streakRes] = await Promise.all([
        supabase
          .from("activity_days")
          .select("day")
          .eq("student_id", studentId!)
          .order("day", { ascending: false })
          .limit(120),
        supabase
          .from("streaks")
          .select("current_days, best_days")
          .eq("student_id", studentId!)
          .maybeSingle(),
      ]);
      if (activityRes.error) throw activityRes.error;
      if (streakRes.error) throw streakRes.error;
      const activeDays = (activityRes.data ?? []).map((r: { day: string }) => r.day);
      return {
        activeDays,
        currentDays: Number(streakRes.data?.current_days ?? 0),
        bestDays: Number(streakRes.data?.best_days ?? 0),
      };
    },
  });
}
