import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/features/auth/useSession";
import {
  isNetworkError,
  NETWORK_ERROR_MESSAGE,
  withTimeout,
} from "@/features/auth/network-errors";

export interface AttendanceRow {
  id: string;
  session_id: string;
  status: "present" | "late" | "absent";
  method: "qr" | "manual" | "correction";
  marked_at: string;
  subject_name: string | null;
  title: string | null;
  scheduled_start: string | null;
}

export interface AttendanceStats {
  weekPresent: number;
  weekTotal: number;
  monthPresent: number;
  monthTotal: number;
  recent: AttendanceRow[];
}

function startOfIstWeek(): Date {
  // Last 7 days inclusive of today; cheap "this week" until we wire a real
  // Monday-anchored boundary in Phase 8.
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 6);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function startOfIstMonth(): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 29);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

interface State {
  data: AttendanceStats | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useAttendanceHistory(): State {
  const { appUser } = useSession();
  const [data, setData] = useState<AttendanceStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!appUser?.id) {
      setData(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const since = startOfIstMonth().toISOString();
      const res = await withTimeout(
        supabase
          .from("attendance")
          .select(
            "id, session_id, status, method, marked_at, sessions(scheduled_start, title, subjects(name))",
          )
          .eq("student_id", appUser.id)
          .gte("marked_at", since)
          .order("marked_at", { ascending: false }),
      );
      if (res.error) {
        setError(res.error.message);
        setData(null);
        return;
      }
      const rows = (res.data ?? []) as unknown as Array<{
        id: string;
        session_id: string;
        status: "present" | "late" | "absent";
        method: "qr" | "manual" | "correction";
        marked_at: string;
        sessions: { scheduled_start: string | null; title: string | null; subjects: { name: string } | null } | null;
      }>;

      const recent: AttendanceRow[] = rows.map((r) => ({
        id: r.id,
        session_id: r.session_id,
        status: r.status,
        method: r.method,
        marked_at: r.marked_at,
        subject_name: r.sessions?.subjects?.name ?? null,
        title: r.sessions?.title ?? null,
        scheduled_start: r.sessions?.scheduled_start ?? null,
      }));

      const weekStart = startOfIstWeek().getTime();
      let weekPresent = 0;
      let weekTotal = 0;
      let monthPresent = 0;
      let monthTotal = 0;
      for (const r of rows) {
        const t = new Date(r.marked_at).getTime();
        monthTotal += 1;
        if (r.status !== "absent") monthPresent += 1;
        if (t >= weekStart) {
          weekTotal += 1;
          if (r.status !== "absent") weekPresent += 1;
        }
      }
      setData({ weekPresent, weekTotal, monthPresent, monthTotal, recent });
    } catch (err) {
      setError(
        isNetworkError(err) ? NETWORK_ERROR_MESSAGE : "Couldn't load history.",
      );
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [appUser?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, isLoading, error, refresh: load };
}
