// Phase 9 CP10 — a single session row for the live / recording / live-control
// screens. sessions aren't in the Realtime publication, so the lobby opts into
// a 10s poll until the class flips to live or ended.

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  isNetworkError,
  NETWORK_ERROR_MESSAGE,
  withTimeout,
} from "@/features/auth/network-errors";

export interface LiveSessionRow {
  id: string;
  batch_id: string;
  subject_name: string | null;
  status: "scheduled" | "live" | "ended" | "cancelled";
  is_live_class: boolean;
  yt_video_id: string | null;
  scheduled_start: string;
  scheduled_end: string;
  started_at: string | null;
  ended_at: string | null;
}

interface RawRow {
  id: string;
  batch_id: string;
  status: LiveSessionRow["status"];
  is_live_class: boolean;
  yt_video_id: string | null;
  scheduled_start: string;
  scheduled_end: string;
  started_at: string | null;
  ended_at: string | null;
  subjects: { name: string } | null;
}

interface State {
  session: LiveSessionRow | null;
  isLoading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

export function useLiveSession(
  sessionId: string | undefined,
  opts?: { pollWhileNotLive?: boolean },
): State {
  const pollWhileNotLive = opts?.pollWhileNotLive ?? false;
  const [session, setSession] = useState<LiveSessionRow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!sessionId) return;
    setError(null);
    try {
      const res = await withTimeout(
        supabase
          .from("sessions")
          .select(
            "id, batch_id, status, is_live_class, yt_video_id, scheduled_start, scheduled_end, started_at, ended_at, subject_id, subjects(name)",
          )
          .eq("id", sessionId)
          .maybeSingle(),
      );
      if (res.error) {
        setError(res.error.message);
        return;
      }
      const r = res.data as unknown as RawRow | null;
      if (!r) {
        setSession(null);
        setError("Class not found.");
        return;
      }
      setSession({
        id: r.id,
        batch_id: r.batch_id,
        subject_name: r.subjects?.name ?? null,
        status: r.status,
        is_live_class: r.is_live_class,
        yt_video_id: r.yt_video_id,
        scheduled_start: r.scheduled_start,
        scheduled_end: r.scheduled_end,
        started_at: r.started_at,
        ended_at: r.ended_at,
      });
    } catch (err) {
      setError(isNetworkError(err) ? NETWORK_ERROR_MESSAGE : "Couldn't load the class.");
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!pollWhileNotLive || !session) return;
    if (session.status === "live" || session.status === "ended") return;
    const t = setInterval(() => {
      void load();
    }, 10_000);
    return () => clearInterval(t);
  }, [pollWhileNotLive, session, load]);

  return { session, isLoading, error, reload: load };
}
