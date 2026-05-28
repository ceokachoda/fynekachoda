"use client";

// Phase 4 (Web) — viewer's own ban state, live. Mirrors mobile useSessionState.
//
// Pinned announcements + end-of-class signal travel as chat_messages over
// useChatChannel, so this hook only owns the one thing that needs its own
// subscription: whether the current viewer has been banned from this session.
// chat_bans is in the Realtime publication and cb_read lets a user see their
// own ban row, so the composer disables the moment a ban lands.

import { useEffect, useMemo, useState } from "react";
import type {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
} from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useSession } from "@/features/auth/SessionProvider";

interface BanRow {
  session_id: string;
  user_id: string;
}

export function useSessionState(
  sessionId: string | undefined,
): { isBanned: boolean } {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const { appUser } = useSession();
  const [isBanned, setIsBanned] = useState(false);

  useEffect(() => {
    if (!sessionId || !appUser?.id) return;
    let active = true;

    void (async () => {
      const res = await supabase
        .from("chat_bans")
        .select("user_id")
        .eq("session_id", sessionId)
        .eq("user_id", appUser.id)
        .maybeSingle();
      if (active && !res.error) setIsBanned(!!res.data);
    })();

    const channel: RealtimeChannel = supabase
      .channel(`ban-${sessionId}-${appUser.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chat_bans",
          filter: `user_id=eq.${appUser.id}`,
        },
        (payload: RealtimePostgresChangesPayload<BanRow>) => {
          const rowSession =
            (payload.new as Partial<BanRow> | undefined)?.session_id ??
            (payload.old as Partial<BanRow> | undefined)?.session_id;
          if (rowSession !== sessionId) return;
          setIsBanned(payload.eventType !== "DELETE");
        },
      );
    channel.subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [sessionId, appUser?.id, supabase]);

  return { isBanned };
}
