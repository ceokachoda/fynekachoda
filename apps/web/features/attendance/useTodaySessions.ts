"use client";

import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/features/auth/SessionProvider";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useMyBatch } from "@/features/org/useMyBatch";
import { istStartOfDay, istEndOfDay } from "@/lib/ist";

const SCAN_WINDOW_BEFORE_MS = 15 * 60 * 1000;
const SCAN_WINDOW_AFTER_MS = 15 * 60 * 1000;

export interface TodaySession {
  id: string;
  subject_name: string;
  title: string | null;
  scheduled_start: string;
  scheduled_end: string;
  is_ad_hoc: boolean;
  attendance_status: "present" | "late" | "absent" | null;
  window: "before" | "open" | "after";
}

interface RawSession {
  id: string;
  scheduled_start: string;
  scheduled_end: string;
  is_ad_hoc: boolean | null;
  title: string | null;
  subjects: { name: string } | null;
}

export function scanWindow(
  scheduled_start: string,
  scheduled_end: string,
  now: number = Date.now(),
): "before" | "open" | "after" {
  const start = new Date(scheduled_start).getTime();
  const end = new Date(scheduled_end).getTime();
  if (now < start - SCAN_WINDOW_BEFORE_MS) return "before";
  if (now > end + SCAN_WINDOW_AFTER_MS) return "after";
  return "open";
}

export function useTodaySessions() {
  const { appUser } = useSession();
  const studentId = appUser?.id;
  const { data: batch } = useMyBatch();
  return useQuery<TodaySession[]>({
    queryKey: ["today-sessions", studentId, batch?.batch_id],
    enabled: !!studentId && !!batch?.batch_id,
    staleTime: 30_000,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const startIso = istStartOfDay().toISOString();
      const endIso = istEndOfDay().toISOString();

      const { data: sessions, error } = await supabase
        .from("sessions")
        .select(
          "id, scheduled_start, scheduled_end, is_ad_hoc, title, subjects(name)",
        )
        .eq("batch_id", batch!.batch_id)
        .neq("status", "cancelled")
        .gte("scheduled_start", startIso)
        .lt("scheduled_start", endIso)
        .order("scheduled_start");
      if (error) throw error;

      const rows = (sessions ?? []) as unknown as RawSession[];
      const sessionIds = rows.map((s) => s.id);
      const attendance = new Map<string, "present" | "late" | "absent">();
      if (sessionIds.length > 0) {
        const { data: att } = await supabase
          .from("attendance")
          .select("session_id, status")
          .eq("student_id", studentId!)
          .in("session_id", sessionIds);
        for (const a of (att ?? []) as Array<{
          session_id: string;
          status: "present" | "late" | "absent";
        }>) {
          attendance.set(a.session_id, a.status);
        }
      }

      const now = Date.now();
      return rows.map<TodaySession>((s) => ({
        id: s.id,
        subject_name: s.subjects?.name ?? "Class",
        title: s.title ?? null,
        scheduled_start: s.scheduled_start,
        scheduled_end: s.scheduled_end,
        is_ad_hoc: !!s.is_ad_hoc,
        attendance_status: attendance.get(s.id) ?? null,
        window: scanWindow(s.scheduled_start, s.scheduled_end, now),
      }));
    },
  });
}
