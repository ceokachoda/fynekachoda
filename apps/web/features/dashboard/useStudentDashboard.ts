"use client";

import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/features/auth/SessionProvider";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { StudentDashboard } from "./types";

// One round-trip to the public.student_dashboard(p_student) SQL fn (Phase 8).
// The fn coalesces every slice, so `data` is always well-formed once loaded.
export function useStudentDashboard() {
  const { appUser } = useSession();
  const studentId = appUser?.id;
  return useQuery<StudentDashboard | null>({
    queryKey: ["student-dashboard", studentId],
    enabled: !!studentId,
    staleTime: 30_000,
    // Poll while visible so the "Up next" card flips to a live class shortly
    // after a teacher goes live (sessions aren't in the realtime publication).
    refetchInterval: 30_000,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase.rpc("student_dashboard", {
        p_student: studentId!,
      });
      if (error) throw error;
      return data as unknown as StudentDashboard;
    },
  });
}
