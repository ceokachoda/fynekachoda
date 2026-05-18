import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  isNetworkError,
  NETWORK_ERROR_MESSAGE,
  withTimeout,
} from "@/features/auth/network-errors";

export type AttendanceStatus = "present" | "late" | "absent";

export interface RosterStudent {
  user_id: string;
  full_name: string;
  attendance_id: string | null;
  status: AttendanceStatus | null;
  method: "qr" | "manual" | "correction" | null;
  marked_at: string | null;
}

export interface SessionMeta {
  id: string;
  batch_id: string;
  batch_name: string;
  subject_name: string | null;
  scheduled_start: string;
  scheduled_end: string;
  is_ad_hoc: boolean;
}

interface RawSessionRow {
  id: string;
  batch_id: string;
  scheduled_start: string;
  scheduled_end: string;
  is_ad_hoc: boolean;
  subjects: { name: string } | null;
  batches: { name: string } | null;
}

interface RawStudentRow {
  user_id: string;
  app_users: { full_name: string } | null;
}

interface RawAttendanceRow {
  id: string;
  student_id: string;
  status: AttendanceStatus;
  method: "qr" | "manual" | "correction";
  marked_at: string;
}

interface State {
  meta: SessionMeta | null;
  students: RosterStudent[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useRoster(sessionId: string | null): State {
  const [meta, setMeta] = useState<SessionMeta | null>(null);
  const [students, setStudents] = useState<RosterStudent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const load = useCallback(async () => {
    if (!sessionId) {
      setMeta(null);
      setStudents([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const sessionRes = await withTimeout(
        supabase
          .from("sessions")
          .select(
            "id, batch_id, scheduled_start, scheduled_end, is_ad_hoc, subjects(name), batches(name)",
          )
          .eq("id", sessionId)
          .maybeSingle(),
      );
      if (sessionRes.error) {
        setError(sessionRes.error.message);
        setIsLoading(false);
        return;
      }
      if (!sessionRes.data) {
        setError("Session not found, or you don't have access.");
        setIsLoading(false);
        return;
      }
      const s = sessionRes.data as unknown as RawSessionRow;
      const sessionMeta: SessionMeta = {
        id: s.id,
        batch_id: s.batch_id,
        batch_name: s.batches?.name ?? "—",
        subject_name: s.subjects?.name ?? null,
        scheduled_start: s.scheduled_start,
        scheduled_end: s.scheduled_end,
        is_ad_hoc: s.is_ad_hoc,
      };
      setMeta(sessionMeta);

      const [studentsRes, attRes] = await Promise.all([
        withTimeout(
          supabase
            .from("students")
            .select("user_id, app_users!user_id(full_name)")
            .eq("batch_id", s.batch_id),
        ),
        withTimeout(
          supabase
            .from("attendance")
            .select("id, student_id, status, method, marked_at")
            .eq("session_id", sessionId),
        ),
      ]);

      if (studentsRes.error) {
        setError(studentsRes.error.message);
        setIsLoading(false);
        return;
      }
      if (attRes.error) {
        setError(attRes.error.message);
        setIsLoading(false);
        return;
      }

      const attBy = new Map<string, RawAttendanceRow>();
      for (const a of (attRes.data ?? []) as unknown as RawAttendanceRow[]) {
        attBy.set(a.student_id, a);
      }

      const list: RosterStudent[] = (
        (studentsRes.data ?? []) as unknown as RawStudentRow[]
      )
        .map((row) => {
          const att = attBy.get(row.user_id);
          return {
            user_id: row.user_id,
            full_name: row.app_users?.full_name ?? "—",
            attendance_id: att?.id ?? null,
            status: att?.status ?? null,
            method: att?.method ?? null,
            marked_at: att?.marked_at ?? null,
          };
        })
        .sort((a, b) => a.full_name.localeCompare(b.full_name));
      setStudents(list);
    } catch (err) {
      setError(
        isNetworkError(err) ? NETWORK_ERROR_MESSAGE : "Couldn't load roster.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!sessionId) return;
    const channel = supabase
      .channel(`teacher-roster-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "attendance",
          filter: `session_id=eq.${sessionId}`,
        },
        () => {
          void load();
        },
      )
      .subscribe();
    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [sessionId, load]);

  return { meta, students, isLoading, error, refresh: load };
}
