"use client";

// Phase 4 Track 4B — list teacher's sessions across past 30 / today / next 14
// days with per-session attendance counts. Mirrors mobile
// features/attendance/useTeacherSessions.ts.

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useSession } from "@/features/auth/SessionProvider";

export type SessionBucket = "today" | "upcoming" | "past";

export interface TeacherSession {
  id: string;
  batch_id: string;
  batch_name: string;
  course_code: string;
  scheduled_start: string;
  scheduled_end: string;
  subject_name: string | null;
  title: string | null;
  is_ad_hoc: boolean;
  is_live_class: boolean;
  status: "scheduled" | "live" | "ended" | "cancelled";
  bucket: SessionBucket;
  attendance_count: number;
  batch_student_count: number;
}

const PAST_WINDOW_DAYS = 30;
const UPCOMING_WINDOW_DAYS = 14;

function istTodayBounds(): { startMs: number; endMs: number } {
  const todayIst = new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Kolkata",
  });
  const start = new Date(`${todayIst}T00:00:00+05:30`).getTime();
  return { startMs: start, endMs: start + 24 * 60 * 60 * 1000 };
}

function classify(start: string, end: string): SessionBucket {
  const now = Date.now();
  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();
  const { startMs: tStart, endMs: tEnd } = istTodayBounds();
  if (startMs >= tStart && startMs < tEnd) return "today";
  if (endMs < now) return "past";
  return "upcoming";
}

interface RawSessionRow {
  id: string;
  batch_id: string;
  scheduled_start: string;
  scheduled_end: string;
  title: string | null;
  is_ad_hoc: boolean;
  is_live_class: boolean;
  status: "scheduled" | "live" | "ended" | "cancelled";
  subjects: { name: string } | null;
  batches: {
    name: string;
    courses: { code: string } | null;
    students: { count: number }[] | null;
  } | null;
}

export function useTeacherSessions() {
  const { appUser, roles } = useSession();
  const teacherId = appUser?.id ?? null;
  const isTeacher = roles.includes("teacher");

  const query = useQuery({
    queryKey: ["teacher-sessions", teacherId],
    enabled: !!teacherId && isTeacher,
    queryFn: async (): Promise<TeacherSession[]> => {
      const supabase = createSupabaseBrowserClient();
      const batchesRes = await supabase
        .from("batch_teachers")
        .select("batch_id")
        .eq("teacher_id", teacherId);
      if (batchesRes.error) throw new Error(batchesRes.error.message);
      const batchIds = (batchesRes.data ?? []).map(
        (r: { batch_id: string }) => r.batch_id,
      );
      if (batchIds.length === 0) return [];

      const nowMs = Date.now();
      const pastBoundary = new Date(
        nowMs - PAST_WINDOW_DAYS * 24 * 60 * 60 * 1000,
      ).toISOString();
      const upcomingBoundary = new Date(
        nowMs + UPCOMING_WINDOW_DAYS * 24 * 60 * 60 * 1000,
      ).toISOString();
      const sessionsRes = await supabase
        .from("sessions")
        .select(
          "id, batch_id, scheduled_start, scheduled_end, title, is_ad_hoc, is_live_class, status, subjects(name), batches(name, courses(code), students(count))",
        )
        .in("batch_id", batchIds)
        .gte("scheduled_start", pastBoundary)
        .lte("scheduled_start", upcomingBoundary)
        .order("scheduled_start", { ascending: true });
      if (sessionsRes.error) throw new Error(sessionsRes.error.message);

      const rows = (sessionsRes.data ?? []) as unknown as RawSessionRow[];
      const sessionIds = rows.map((s) => s.id);
      const attCounts = new Map<string, number>();
      if (sessionIds.length > 0) {
        const attRes = await supabase
          .from("attendance")
          .select("session_id")
          .in("session_id", sessionIds);
        if (!attRes.error) {
          for (const r of (attRes.data ?? []) as { session_id: string }[]) {
            attCounts.set(r.session_id, (attCounts.get(r.session_id) ?? 0) + 1);
          }
        }
      }

      return rows.map((r) => ({
        id: r.id,
        batch_id: r.batch_id,
        batch_name: r.batches?.name ?? "—",
        course_code: r.batches?.courses?.code ?? "—",
        scheduled_start: r.scheduled_start,
        scheduled_end: r.scheduled_end,
        subject_name: r.subjects?.name ?? null,
        title: r.title ?? null,
        is_ad_hoc: r.is_ad_hoc,
        is_live_class: r.is_live_class,
        status: r.status,
        bucket: classify(r.scheduled_start, r.scheduled_end),
        attendance_count: attCounts.get(r.id) ?? 0,
        batch_student_count: r.batches?.students?.[0]?.count ?? 0,
      }));
    },
    staleTime: 30_000,
  });

  const buckets = useMemo<Record<SessionBucket, TeacherSession[]>>(() => {
    const out: Record<SessionBucket, TeacherSession[]> = {
      today: [],
      upcoming: [],
      past: [],
    };
    for (const s of query.data ?? []) out[s.bucket].push(s);
    out.past.reverse();
    return out;
  }, [query.data]);

  return { ...query, buckets };
}

export function pickNearestSession(
  sessions: TeacherSession[],
): TeacherSession | null {
  if (sessions.length === 0) return null;
  const now = Date.now();
  const live = sessions.find((s) => {
    const start = new Date(s.scheduled_start).getTime();
    const end = new Date(s.scheduled_end).getTime();
    return now >= start - 15 * 60 * 1000 && now <= end + 15 * 60 * 1000;
  });
  if (live) return live;
  const upcoming = sessions
    .filter((s) => new Date(s.scheduled_start).getTime() > now)
    .sort(
      (a, b) =>
        new Date(a.scheduled_start).getTime() -
        new Date(b.scheduled_start).getTime(),
    )[0];
  return upcoming ?? null;
}
