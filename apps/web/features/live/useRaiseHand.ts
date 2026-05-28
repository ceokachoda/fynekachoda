"use client";

// Phase 4 (Web) — raise-hand over Postgres CDC. Mirrors mobile useRaiseHand.
// Student view: tracks whether their own hand is up; raise() / lower().
// Teacher view: an ordered queue of unresolved hands with student names
// (readable because teachers may read their batch students' app_users — D-152),
// and resolve(). Both branches re-query on any raise_hand_events change.
// Channel is removed on unmount — no ghost subscriptions.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useSession } from "@/features/auth/SessionProvider";

export interface RaiseHandItem {
  id: string;
  student_id: string;
  student_name: string;
  raised_at: string;
}

export interface RaiseHandState {
  myHandRaised: boolean;
  isBusy: boolean;
  raise: () => Promise<void>;
  lower: () => Promise<void>;
  queue: RaiseHandItem[];
  resolve: (id: string) => Promise<void>;
}

interface QueueRow {
  id: string;
  student_id: string;
  raised_at: string;
}

export function useRaiseHand(sessionId: string | undefined): RaiseHandState {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const { appUser, roles } = useSession();
  const isTeacher = roles.includes("teacher");
  const [myHandRaised, setMyHandRaised] = useState(false);
  const [queue, setQueue] = useState<RaiseHandItem[]>([]);
  const [isBusy, setIsBusy] = useState(false);
  const namesRef = useRef<Map<string, string>>(new Map());

  const loadTeacherQueue = useCallback(async () => {
    if (!sessionId || !isTeacher) return;
    const res = await supabase
      .from("raise_hand_events")
      .select("id, student_id, raised_at")
      .eq("session_id", sessionId)
      .is("resolved_at", null)
      .order("raised_at", { ascending: true });
    if (res.error) return;
    const rows = (res.data ?? []) as unknown as QueueRow[];
    const unknown = rows
      .map((r) => r.student_id)
      .filter((id) => !namesRef.current.has(id));
    if (unknown.length > 0) {
      const nameRes = await supabase
        .from("app_users")
        .select("id, full_name")
        .in("id", unknown);
      (
        (nameRes.data ?? []) as unknown as Array<{ id: string; full_name: string }>
      ).forEach((u) => namesRef.current.set(u.id, u.full_name));
    }
    setQueue(
      rows.map((r) => ({
        id: r.id,
        student_id: r.student_id,
        student_name: namesRef.current.get(r.student_id) ?? "Student",
        raised_at: r.raised_at,
      })),
    );
  }, [sessionId, isTeacher, supabase]);

  const loadMyHand = useCallback(async () => {
    if (!sessionId || !appUser?.id || isTeacher) return;
    const res = await supabase
      .from("raise_hand_events")
      .select("id")
      .eq("session_id", sessionId)
      .eq("student_id", appUser.id)
      .is("resolved_at", null)
      .maybeSingle();
    if (!res.error) setMyHandRaised(!!res.data);
  }, [sessionId, appUser?.id, isTeacher, supabase]);

  useEffect(() => {
    void loadTeacherQueue();
    void loadMyHand();
  }, [loadTeacherQueue, loadMyHand]);

  useEffect(() => {
    if (!sessionId) return;
    const channel: RealtimeChannel = supabase
      .channel(`hands-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "raise_hand_events",
          filter: `session_id=eq.${sessionId}`,
        },
        () => {
          void loadTeacherQueue();
          void loadMyHand();
        },
      );
    channel.subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [sessionId, supabase, loadTeacherQueue, loadMyHand]);

  const raise = useCallback(async () => {
    if (!sessionId || !appUser?.id || isBusy) return;
    setIsBusy(true);
    setMyHandRaised(true);
    const res = await supabase.from("raise_hand_events").insert({
      session_id: sessionId,
      student_id: appUser.id,
    });
    if (res.error) {
      void loadMyHand();
    }
    setIsBusy(false);
  }, [sessionId, appUser?.id, isBusy, loadMyHand, supabase]);

  const lower = useCallback(async () => {
    if (!sessionId || !appUser?.id) return;
    setMyHandRaised(false);
    await supabase
      .from("raise_hand_events")
      .update({ resolved_at: new Date().toISOString() })
      .eq("session_id", sessionId)
      .eq("student_id", appUser.id)
      .is("resolved_at", null);
  }, [sessionId, appUser?.id, supabase]);

  const resolve = useCallback(
    async (id: string) => {
      setQueue((q) => q.filter((h) => h.id !== id));
      await supabase
        .from("raise_hand_events")
        .update({
          resolved_at: new Date().toISOString(),
          resolved_by: appUser?.id,
        })
        .eq("id", id);
    },
    [appUser?.id, supabase],
  );

  return { myHandRaised, isBusy, raise, lower, queue, resolve };
}
