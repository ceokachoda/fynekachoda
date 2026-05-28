"use client";

// Phase 4 Track 4B — teacher-side view of ALL bans in the session, used by
// the moderation menu to render "Mute" vs "Unmute" labels and by the raise-
// hand queue to drop banned students. Realtime: `bans-${sessionId}`.

import { useCallback, useEffect, useMemo, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export interface SessionBan {
  user_id: string;
  banned_at: string;
}

export function useSessionBans(sessionId: string | undefined) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [bans, setBans] = useState<SessionBan[]>([]);

  const load = useCallback(async () => {
    if (!sessionId) {
      setBans([]);
      return;
    }
    const res = await supabase
      .from("chat_bans")
      .select("user_id, banned_at")
      .eq("session_id", sessionId);
    if (!res.error) {
      setBans(((res.data ?? []) as SessionBan[]).map((r) => ({ ...r })));
    }
  }, [sessionId, supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!sessionId) return;
    const channel: RealtimeChannel = supabase
      .channel(`bans-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chat_bans",
          filter: `session_id=eq.${sessionId}`,
        },
        () => {
          void load();
        },
      );
    channel.subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [sessionId, supabase, load]);

  const isBanned = useCallback(
    (userId: string | undefined | null) =>
      !!userId && bans.some((b) => b.user_id === userId),
    [bans],
  );

  return { bans, isBanned, reload: load };
}
