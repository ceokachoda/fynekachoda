"use client";

// Phase 4 Track 4B — session roster + realtime sync. Mirrors mobile
// features/attendance/useRoster.ts. The channel name MUST be
// `teacher-roster-${sessionId}` (matches mobile + the
// realtimeCleanupAudit.test.ts naming convention).

import { useCallback, useEffect, useMemo, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export type AttendanceStatus = "present" | "late" | "absent";

export interface RosterStudent {
  user_id: string;
  full_name: string;
  attendance_id: string | null;
  status: AttendanceStatus | null;
  method: "qr" | "manual" | "correction" | null;
  marked_at: string | null;
}

export interface RosterSessionMeta {
  id: string;
  batch_id: string;
  batch_name: string;
  subject_name: string | null;
  title: string | null;
  scheduled_start: string;
  scheduled_end: string;
  is_ad_hoc: boolean;
}

interface RawSessionRow {
  id: string;
  batch_id: string;
  scheduled_start: string;
  scheduled_end: string;
  title: string | null;
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

export function useRoster(sessionId: string | null) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [meta, setMeta] = useState<RosterSessionMeta | null>(null);
  const [students, setStudents] = useState<RosterStudent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      const sessionRes = await supabase
        .from("sessions")
        .select(
          "id, batch_id, scheduled_start, scheduled_end, title, is_ad_hoc, subjects(name), batches(name)",
        )
        .eq("id", sessionId)
        .maybeSingle();
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
      setMeta({
        id: s.id,
        batch_id: s.batch_id,
        batch_name: s.batches?.name ?? "—",
        subject_name: s.subjects?.name ?? null,
        title: s.title ?? null,
        scheduled_start: s.scheduled_start,
        scheduled_end: s.scheduled_end,
        is_ad_hoc: s.is_ad_hoc,
      });

      const [studentsRes, attRes] = await Promise.all([
        supabase
          .from("students")
          .select("user_id, app_users!user_id(full_name)")
          .eq("batch_id", s.batch_id),
        supabase
          .from("attendance")
          .select("id, student_id, status, method, marked_at")
          .eq("session_id", sessionId),
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
      setError(err instanceof Error ? err.message : "Couldn't load roster.");
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!sessionId) return;
    // Coalesce bursts of attendance changes (e.g. a bulk-mark inserting one row
    // per student) into a single reload after a short quiet window, so the
    // roster doesn't re-query + re-sort + replace the whole list per event.
    // Mirrors the mobile useRoster debounce.
    let debounce: ReturnType<typeof setTimeout> | null = null;
    const scheduleReload = () => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => {
        void load();
      }, 600);
    };
    const channel: RealtimeChannel = supabase
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
          scheduleReload();
        },
      );
    channel.subscribe();
    return () => {
      if (debounce) clearTimeout(debounce);
      void supabase.removeChannel(channel);
    };
  }, [sessionId, supabase, load]);

  return { meta, students, isLoading, error, refresh: load };
}
