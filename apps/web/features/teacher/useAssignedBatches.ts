"use client";

// Phase 4 Track 4B — list batches assigned to the current teacher with student
// counts + next-session label. Mirrors mobile features/org/useAssignedBatches.

import { useQuery } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useSession } from "@/features/auth/SessionProvider";

export interface AssignedBatch {
  batch_id: string;
  batch_name: string;
  course_code: string;
  course_name: string;
  student_count: number;
  next_session: { label: string } | null;
}

interface ScheduleRow {
  weekday: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function fmtTime(t: string): string {
  // PostgreSQL "HH:MM:SS" → "HH:MM".
  return t.slice(0, 5);
}

function pickNextSessionLabel(rows: ScheduleRow[]): { label: string } | null {
  const active = rows.filter((r) => r.is_active);
  if (active.length === 0) return null;
  const now = new Date();
  const today = now.getDay();
  // Find the soonest weekday >= today.
  const sorted = active
    .slice()
    .sort((a, b) => {
      const aDelta = (a.weekday - today + 7) % 7;
      const bDelta = (b.weekday - today + 7) % 7;
      return aDelta - bDelta;
    });
  const next = sorted[0];
  if (!next) return null;
  const delta = (next.weekday - today + 7) % 7;
  const dayLabel =
    delta === 0 ? "Today" : delta === 1 ? "Tomorrow" : (WEEKDAYS[next.weekday] ?? "");
  return { label: `${dayLabel} ${fmtTime(next.start_time)}` };
}

export function useAssignedBatches() {
  const { appUser, roles } = useSession();
  const teacherId = appUser?.id;
  const isTeacher = roles.includes("teacher");

  return useQuery({
    queryKey: ["assigned-batches", teacherId],
    enabled: !!teacherId && isTeacher,
    queryFn: async (): Promise<AssignedBatch[]> => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("batches")
        .select(
          "id, name, is_active, courses(code, name), students(count), batch_schedule(weekday, start_time, end_time, is_active), batch_teachers!inner(teacher_id)",
        )
        .eq("is_active", true)
        .eq("batch_teachers.teacher_id", teacherId)
        .order("name", { ascending: true });
      if (error) throw new Error(error.message);
      type Row = {
        id: string;
        name: string;
        is_active: boolean;
        courses: { code: string; name: string } | null;
        students: { count: number }[] | null;
        batch_schedule: ScheduleRow[] | null;
      };
      const rows = (data ?? []) as unknown as Row[];
      return rows.map((b) => ({
        batch_id: b.id,
        batch_name: b.name,
        course_code: b.courses?.code ?? "—",
        course_name: b.courses?.name ?? "—",
        student_count: b.students?.[0]?.count ?? 0,
        next_session: pickNextSessionLabel(b.batch_schedule ?? []),
      }));
    },
    staleTime: 60_000,
  });
}
