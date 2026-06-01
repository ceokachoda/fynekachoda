import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/features/auth/useSession";
import { useMyBatch } from "@/features/org/useMyBatch";
import {
  isNetworkError,
  NETWORK_ERROR_MESSAGE,
  withTimeout,
} from "@/features/auth/network-errors";

export interface TodaySession {
  id: string;
  scheduled_start: string;
  scheduled_end: string;
  subject_name: string | null;
  title: string | null;
  is_ad_hoc: boolean;
  attendance_status: "present" | "late" | "absent" | null;
  window: "before" | "open" | "closed";
}

function istBoundaryIsoForToday(): { startIso: string; endIso: string } {
  // Build [today_IST 00:00, tomorrow_IST 00:00) in UTC ISO format. We sub-
  // tract one second from the end to use as inclusive upper bound in PG.
  const todayIst = new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Kolkata",
  });
  // IST = UTC+5:30; `${today}T00:00:00+05:30` parses to today midnight IST.
  const startIso = new Date(`${todayIst}T00:00:00+05:30`).toISOString();
  const endIso = new Date(
    new Date(`${todayIst}T00:00:00+05:30`).getTime() + 24 * 60 * 60 * 1000,
  ).toISOString();
  return { startIso, endIso };
}

const SCAN_WINDOW_BEFORE_MS = 15 * 60 * 1000;
const SCAN_WINDOW_AFTER_MS = 15 * 60 * 1000;

function classifyWindow(
  start: string,
  end: string,
): "before" | "open" | "closed" {
  const now = Date.now();
  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();
  if (now < startMs - SCAN_WINDOW_BEFORE_MS) return "before";
  if (now > endMs + SCAN_WINDOW_AFTER_MS) return "closed";
  return "open";
}

interface State {
  sessions: TodaySession[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useTodaySessions(): State {
  const { appUser } = useSession();
  const { data: myBatch, isLoading: batchLoading } = useMyBatch();
  const [sessions, setSessions] = useState<TodaySession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    // Wait for the batch query to settle before deciding "no sessions" — else
    // the screen briefly renders the empty state on cold start.
    if (batchLoading) {
      setIsLoading(true);
      return;
    }
    if (!appUser?.id || !myBatch?.batch_id) {
      setSessions([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const { startIso, endIso } = istBoundaryIsoForToday();
      const sessionsRes = await withTimeout(
        supabase
          .from("sessions")
          .select(
            "id, scheduled_start, scheduled_end, is_ad_hoc, subject_id, title, subjects(name)",
          )
          .eq("batch_id", myBatch.batch_id)
          .gte("scheduled_start", startIso)
          .lt("scheduled_start", endIso)
          .order("scheduled_start", { ascending: true }),
      );
      if (sessionsRes.error) {
        setError(sessionsRes.error.message);
        setIsLoading(false);
        return;
      }
      const sessionRows = (sessionsRes.data ?? []) as unknown as Array<{
        id: string;
        scheduled_start: string;
        scheduled_end: string;
        is_ad_hoc: boolean;
        title: string | null;
        subjects: { name: string } | null;
      }>;

      if (sessionRows.length === 0) {
        setSessions([]);
        setIsLoading(false);
        return;
      }

      const sessionIds = sessionRows.map((s) => s.id);
      const attRes = await withTimeout(
        supabase
          .from("attendance")
          .select("session_id, status")
          .eq("student_id", appUser.id)
          .in("session_id", sessionIds),
      );
      if (attRes.error) {
        setError(attRes.error.message);
        setIsLoading(false);
        return;
      }
      const attBySession = new Map<string, "present" | "late" | "absent">();
      for (const a of (attRes.data ?? []) as unknown as Array<{
        session_id: string;
        status: "present" | "late" | "absent";
      }>) {
        attBySession.set(a.session_id, a.status);
      }

      const merged: TodaySession[] = sessionRows.map((s) => ({
        id: s.id,
        scheduled_start: s.scheduled_start,
        scheduled_end: s.scheduled_end,
        subject_name: s.subjects?.name ?? null,
        title: s.title ?? null,
        is_ad_hoc: s.is_ad_hoc,
        attendance_status: attBySession.get(s.id) ?? null,
        window: classifyWindow(s.scheduled_start, s.scheduled_end),
      }));
      setSessions(merged);
    } catch (err) {
      setError(
        isNetworkError(err) ? NETWORK_ERROR_MESSAGE : "Couldn't load today's classes.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [appUser?.id, myBatch?.batch_id, batchLoading]);

  useEffect(() => {
    void load();
  }, [load]);

  return { sessions, isLoading, error, refresh: load };
}
