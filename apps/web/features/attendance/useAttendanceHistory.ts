"use client";

import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/features/auth/SessionProvider";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export interface AttendanceRow {
  id: string;
  session_id: string;
  status: "present" | "late" | "absent";
  method: "qr" | "manual" | "bulk";
  marked_at: string;
  scheduled_start: string | null;
  subject_name: string | null;
}

export interface AttendanceStats {
  weekPresent: number;
  weekTotal: number;
  monthPresent: number;
  monthTotal: number;
  recent: AttendanceRow[];
}

interface RawAttendance {
  id: string;
  session_id: string;
  status: "present" | "late" | "absent";
  method: "qr" | "manual" | "bulk";
  marked_at: string;
  sessions: {
    scheduled_start: string;
    subjects: { name: string } | null;
  } | null;
}

export function useAttendanceHistory() {
  const { appUser } = useSession();
  const studentId = appUser?.id;
  return useQuery<AttendanceStats>({
    queryKey: ["attendance-history", studentId],
    enabled: !!studentId,
    staleTime: 30_000,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const now = Date.now();
      const monthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
      const weekAgo = now - 7 * 24 * 60 * 60 * 1000;

      const { data, error } = await supabase
        .from("attendance")
        .select(
          "id, session_id, status, method, marked_at, sessions(scheduled_start, subjects(name))",
        )
        .eq("student_id", studentId!)
        .gte("marked_at", monthAgo)
        .order("marked_at", { ascending: false });
      if (error) throw error;

      const rows = (data ?? []) as unknown as RawAttendance[];
      const recent = rows.map<AttendanceRow>((r) => ({
        id: r.id,
        session_id: r.session_id,
        status: r.status,
        method: r.method,
        marked_at: r.marked_at,
        scheduled_start: r.sessions?.scheduled_start ?? null,
        subject_name: r.sessions?.subjects?.name ?? null,
      }));

      let weekPresent = 0,
        weekTotal = 0,
        monthPresent = 0,
        monthTotal = 0;
      for (const r of recent) {
        const ts = new Date(r.marked_at).getTime();
        monthTotal++;
        if (r.status === "present" || r.status === "late") monthPresent++;
        if (ts >= weekAgo) {
          weekTotal++;
          if (r.status === "present" || r.status === "late") weekPresent++;
        }
      }

      return { weekPresent, weekTotal, monthPresent, monthTotal, recent };
    },
  });
}
