import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/features/auth/useSession";
import { useMyBatch } from "@/features/org/useMyBatch";
import {
  isNetworkError,
  NETWORK_ERROR_MESSAGE,
  withTimeout,
} from "@/features/auth/network-errors";

export type ScheduleBucket = "live" | "upcoming" | "past";

export interface ScheduleSession {
  id: string;
  scheduled_start: string;
  scheduled_end: string;
  subject_name: string | null;
  status: "scheduled" | "live" | "ended" | "cancelled";
  is_live_class: boolean;
  yt_video_id: string | null;
  attendance_status: "present" | "late" | "absent" | null;
  bucket: ScheduleBucket;
}

interface State {
  sessions: ScheduleSession[];
  isLoading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

const WINDOW_PAST_MS = 7 * 24 * 60 * 60 * 1000;
const WINDOW_FUTURE_MS = 14 * 24 * 60 * 60 * 1000;

function bucketFor(status: string, end: string): ScheduleBucket {
  if (status === "live") return "live";
  if (new Date(end).getTime() < Date.now()) return "past";
  return "upcoming";
}

// A wider sessions feed than useTodaySessions: [now-7d, now+14d] for the
// student's batch, with their attendance status merged in. Used by the
// Classes tab (Phase 8 swap of the Phase-0 placeholder).
export function useStudentSchedule(): State {
  const { appUser } = useSession();
  const { data: myBatch, isLoading: batchLoading } = useMyBatch();
  const [sessions, setSessions] = useState<ScheduleSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
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
      const startIso = new Date(Date.now() - WINDOW_PAST_MS).toISOString();
      const endIso = new Date(Date.now() + WINDOW_FUTURE_MS).toISOString();
      const res = await withTimeout(
        supabase
          .from("sessions")
          .select("id, scheduled_start, scheduled_end, status, is_live_class, yt_video_id, subject_id, subjects(name)")
          .eq("batch_id", myBatch.batch_id)
          .neq("status", "cancelled")
          .gte("scheduled_start", startIso)
          .lte("scheduled_start", endIso)
          .order("scheduled_start", { ascending: true })
          .limit(60),
      );
      if (res.error) {
        setError(res.error.message);
        setIsLoading(false);
        return;
      }
      const rows = (res.data ?? []) as unknown as Array<{
        id: string;
        scheduled_start: string;
        scheduled_end: string;
        status: "scheduled" | "live" | "ended" | "cancelled";
        is_live_class: boolean;
        yt_video_id: string | null;
        subjects: { name: string } | null;
      }>;

      let attBySession = new Map<string, "present" | "late" | "absent">();
      if (rows.length > 0) {
        const attRes = await withTimeout(
          supabase
            .from("attendance")
            .select("session_id, status")
            .eq("student_id", appUser.id)
            .in("session_id", rows.map((r) => r.id)),
        );
        if (!attRes.error) {
          attBySession = new Map(
            ((attRes.data ?? []) as unknown as Array<{
              session_id: string;
              status: "present" | "late" | "absent";
            }>).map((a) => [a.session_id, a.status]),
          );
        }
      }

      setSessions(
        rows.map((r) => ({
          id: r.id,
          scheduled_start: r.scheduled_start,
          scheduled_end: r.scheduled_end,
          subject_name: r.subjects?.name ?? null,
          status: r.status,
          is_live_class: r.is_live_class,
          yt_video_id: r.yt_video_id,
          attendance_status: attBySession.get(r.id) ?? null,
          bucket: bucketFor(r.status, r.scheduled_end),
        })),
      );
    } catch (err) {
      setError(
        isNetworkError(err) ? NETWORK_ERROR_MESSAGE : "Couldn't load your classes.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [appUser?.id, myBatch?.batch_id, batchLoading]);

  useEffect(() => {
    void load();
  }, [load]);

  return { sessions, isLoading, error, reload: load };
}
