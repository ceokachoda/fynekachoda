import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/features/auth/useSession";
import {
  isNetworkError,
  NETWORK_ERROR_MESSAGE,
  withTimeout,
} from "@/features/auth/network-errors";

export type SessionBucket = "today" | "upcoming" | "past";

export interface TeacherSession {
  id: string;
  batch_id: string;
  batch_name: string;
  course_code: string;
  scheduled_start: string;
  scheduled_end: string;
  subject_name: string | null;
  is_ad_hoc: boolean;
  is_live_class: boolean;
  status: "scheduled" | "live" | "ended" | "cancelled";
  bucket: SessionBucket;
  attendance_count: number;
  batch_student_count: number;
}

const PAST_WINDOW_DAYS = 30;
const UPCOMING_WINDOW_DAYS = 14;

function istTodayBounds(): { startIso: string; endIso: string } {
  const todayIst = new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Kolkata",
  });
  const startIso = new Date(`${todayIst}T00:00:00+05:30`).toISOString();
  const endIso = new Date(
    new Date(`${todayIst}T00:00:00+05:30`).getTime() + 24 * 60 * 60 * 1000,
  ).toISOString();
  return { startIso, endIso };
}

function classify(start: string, end: string): SessionBucket {
  const now = Date.now();
  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();
  const today = istTodayBounds();
  const todayStart = new Date(today.startIso).getTime();
  const todayEnd = new Date(today.endIso).getTime();

  if (startMs >= todayStart && startMs < todayEnd) return "today";
  if (endMs < now) return "past";
  return "upcoming";
}

interface RawSessionRow {
  id: string;
  batch_id: string;
  scheduled_start: string;
  scheduled_end: string;
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

interface State {
  sessions: TeacherSession[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useTeacherSessions(): State {
  const { appUser, roles } = useSession();
  const isTeacher = roles.includes("teacher");
  const [sessions, setSessions] = useState<TeacherSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const teacherId = appUser?.id ?? null;

  const load = useCallback(async () => {
    if (!teacherId || !isTeacher) {
      setSessions([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const batchesRes = await withTimeout(
        supabase
          .from("batch_teachers")
          .select("batch_id")
          .eq("teacher_id", teacherId),
      );
      if (batchesRes.error) {
        setError(batchesRes.error.message);
        setSessions([]);
        setIsLoading(false);
        return;
      }
      const batchIds = (batchesRes.data ?? []).map(
        (r) => r.batch_id as string,
      );
      if (batchIds.length === 0) {
        setSessions([]);
        setIsLoading(false);
        return;
      }

      const nowMs = Date.now();
      const pastBoundary = new Date(
        nowMs - PAST_WINDOW_DAYS * 24 * 60 * 60 * 1000,
      ).toISOString();
      const upcomingBoundary = new Date(
        nowMs + UPCOMING_WINDOW_DAYS * 24 * 60 * 60 * 1000,
      ).toISOString();

      const sessionsRes = await withTimeout(
        supabase
          .from("sessions")
          .select(
            "id, batch_id, scheduled_start, scheduled_end, is_ad_hoc, is_live_class, status, subjects(name), batches(name, courses(code), students(count))",
          )
          .in("batch_id", batchIds)
          .gte("scheduled_start", pastBoundary)
          .lte("scheduled_start", upcomingBoundary)
          .order("scheduled_start", { ascending: true }),
      );
      if (sessionsRes.error) {
        setError(sessionsRes.error.message);
        setSessions([]);
        setIsLoading(false);
        return;
      }

      const rows = (sessionsRes.data ?? []) as unknown as RawSessionRow[];
      const sessionIds = rows.map((s) => s.id);

      const attCounts = new Map<string, number>();
      if (sessionIds.length > 0) {
        const attRes = await withTimeout(
          supabase
            .from("attendance")
            .select("session_id")
            .in("session_id", sessionIds),
        );
        if (attRes.error) {
          setError(attRes.error.message);
        } else {
          for (const r of (attRes.data ?? []) as { session_id: string }[]) {
            attCounts.set(r.session_id, (attCounts.get(r.session_id) ?? 0) + 1);
          }
        }
      }

      const mapped: TeacherSession[] = rows.map((r) => ({
        id: r.id,
        batch_id: r.batch_id,
        batch_name: r.batches?.name ?? "—",
        course_code: r.batches?.courses?.code ?? "—",
        scheduled_start: r.scheduled_start,
        scheduled_end: r.scheduled_end,
        subject_name: r.subjects?.name ?? null,
        is_ad_hoc: r.is_ad_hoc,
        is_live_class: r.is_live_class,
        status: r.status,
        bucket: classify(r.scheduled_start, r.scheduled_end),
        attendance_count: attCounts.get(r.id) ?? 0,
        batch_student_count: r.batches?.students?.[0]?.count ?? 0,
      }));
      setSessions(mapped);
    } catch (err) {
      setError(
        isNetworkError(err)
          ? NETWORK_ERROR_MESSAGE
          : "Couldn't load your classes.",
      );
      setSessions([]);
    } finally {
      setIsLoading(false);
    }
  }, [teacherId, isTeacher]);

  useEffect(() => {
    void load();
  }, [load]);

  return { sessions, isLoading, error, refresh: load };
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

export function bucketize(
  sessions: TeacherSession[],
): Record<SessionBucket, TeacherSession[]> {
  const out: Record<SessionBucket, TeacherSession[]> = {
    today: [],
    upcoming: [],
    past: [],
  };
  for (const s of sessions) {
    out[s.bucket].push(s);
  }
  out.past.reverse();
  return out;
}

export function useTeacherSessionsByBucket() {
  const state = useTeacherSessions();
  const buckets = useMemo(() => bucketize(state.sessions), [state.sessions]);
  return { ...state, buckets };
}
