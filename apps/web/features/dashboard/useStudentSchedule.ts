"use client";

import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/features/auth/SessionProvider";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useMyBatch } from "@/features/org/useMyBatch";

const WINDOW_PAST_MS = 7 * 24 * 60 * 60 * 1000;
const WINDOW_FUTURE_MS = 14 * 24 * 60 * 60 * 1000;

export interface ScheduleSession {
  id: string;
  subject_name: string;
  scheduled_start: string;
  scheduled_end: string;
  status: "scheduled" | "live" | "ended" | "cancelled";
  is_live_class: boolean;
  yt_video_id: string | null;
  attendance_status: "present" | "late" | "absent" | null;
  bucket: "past" | "upcoming";
}

interface RawSession {
  id: string;
  scheduled_start: string;
  scheduled_end: string;
  status: string;
  is_live_class: boolean | null;
  yt_video_id: string | null;
  subjects: { name: string } | null;
}

export function useStudentSchedule() {
  const { appUser } = useSession();
  const studentId = appUser?.id;
  const { data: batch } = useMyBatch();

  return useQuery<ScheduleSession[]>({
    queryKey: ["student-schedule", studentId, batch?.batch_id],
    enabled: !!studentId && !!batch?.batch_id,
    staleTime: 30_000,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const now = Date.now();
      const startIso = new Date(now - WINDOW_PAST_MS).toISOString();
      const endIso = new Date(now + WINDOW_FUTURE_MS).toISOString();

      const { data: sessions, error } = await supabase
        .from("sessions")
        .select(
          "id, scheduled_start, scheduled_end, status, is_live_class, yt_video_id, subjects(name)",
        )
        .eq("batch_id", batch!.batch_id)
        .neq("status", "cancelled")
        .gte("scheduled_start", startIso)
        .lte("scheduled_start", endIso)
        .order("scheduled_start")
        .limit(60);
      if (error) throw error;

      const rows = (sessions ?? []) as unknown as RawSession[];
      const sessionIds = rows.map((s) => s.id);
      const attendanceMap = new Map<string, "present" | "late" | "absent">();

      if (sessionIds.length > 0) {
        const { data: att } = await supabase
          .from("attendance")
          .select("session_id, status")
          .eq("student_id", studentId!)
          .in("session_id", sessionIds);
        for (const a of (att ?? []) as Array<{ session_id: string; status: "present" | "late" | "absent" }>) {
          attendanceMap.set(a.session_id, a.status);
        }
      }

      return rows.map<ScheduleSession>((s) => ({
        id: s.id,
        subject_name: s.subjects?.name ?? "Class",
        scheduled_start: s.scheduled_start,
        scheduled_end: s.scheduled_end,
        status: s.status as ScheduleSession["status"],
        is_live_class: !!s.is_live_class,
        yt_video_id: s.yt_video_id,
        attendance_status: attendanceMap.get(s.id) ?? null,
        bucket: new Date(s.scheduled_start).getTime() < now ? "past" : "upcoming",
      }));
    },
  });
}
