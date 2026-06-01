"use client";

// Phase 4 (Web) — a single session row for the live / recording / live-control
// screens. Mirrors mobile features/live/useLiveSession.ts.
//
// `sessions` is not in the Realtime publication, so the lobby opts into a 10s
// poll until the class flips to live or ended.

import { useCallback, useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export interface LiveSessionRow {
  id: string;
  batch_id: string;
  subject_name: string | null;
  title: string | null;
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
  title: string | null;
  subjects: { name: string } | null;
}

export interface LiveSessionState {
  session: LiveSessionRow | null;
  isLoading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

export function useLiveSession(
  sessionId: string | undefined,
  opts?: { pollWhileNotLive?: boolean },
): LiveSessionState {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const pollWhileNotLive = opts?.pollWhileNotLive ?? false;
  const [session, setSession] = useState<LiveSessionRow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!sessionId) return;
    setError(null);
    const res = await supabase
      .from("sessions")
      .select(
        "id, batch_id, status, is_live_class, yt_video_id, scheduled_start, scheduled_end, started_at, ended_at, subject_id, title, subjects(name)",
      )
      .eq("id", sessionId)
      .maybeSingle();
    if (res.error) {
      setError(res.error.message);
      setIsLoading(false);
      return;
    }
    const r = res.data as unknown as RawRow | null;
    if (!r) {
      setSession(null);
      setError("Class not found.");
      setIsLoading(false);
      return;
    }
    setSession({
      id: r.id,
      batch_id: r.batch_id,
      subject_name: r.subjects?.name ?? null,
      title: r.title ?? null,
      status: r.status,
      is_live_class: r.is_live_class,
      yt_video_id: r.yt_video_id,
      scheduled_start: r.scheduled_start,
      scheduled_end: r.scheduled_end,
      started_at: r.started_at,
      ended_at: r.ended_at,
    });
    setIsLoading(false);
  }, [sessionId, supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  // Depend on the status string, not the whole `session` object — each load()
  // returns a fresh object, which would otherwise tear down and re-arm the
  // interval every tick. Re-arms only when the class actually changes state.
  const status = session?.status;
  useEffect(() => {
    if (!pollWhileNotLive || !status) return;
    if (status === "live" || status === "ended") return;
    const t = setInterval(() => {
      void load();
    }, 10_000);
    return () => clearInterval(t);
  }, [pollWhileNotLive, status, load]);

  return { session, isLoading, error, reload: load };
}
