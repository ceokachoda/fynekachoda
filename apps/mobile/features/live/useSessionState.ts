// Phase 9 CP10 — the viewer's own ban state, live.
//
// Pinned announcements + the end-of-class signal travel as chat_messages
// (kind='announcement' / 'system') over useChatChannel, so this hook only owns
// the one thing that needs its own subscription: whether the current viewer has
// been banned from this session's chat. chat_bans is in the Realtime
// publication and cb_read lets a user see their own ban row, so the composer
// disables the instant a ban lands.

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/features/auth/useSession";
import { withTimeout } from "@/features/auth/network-errors";

export function useSessionState(sessionId: string | undefined): { isBanned: boolean } {
  const { appUser } = useSession();
  const [isBanned, setIsBanned] = useState(false);

  useEffect(() => {
    if (!sessionId || !appUser?.id) return;
    let active = true;

    void (async () => {
      const res = await withTimeout(
        supabase
          .from("chat_bans")
          .select("user_id")
          .eq("session_id", sessionId)
          .eq("user_id", appUser.id)
          .maybeSingle(),
      );
      if (active && !res.error) setIsBanned(!!res.data);
    })();

    const channel = supabase
      .channel(`ban-${sessionId}-${appUser.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chat_bans",
          filter: `user_id=eq.${appUser.id}`,
        },
        (payload) => {
          const rowSession =
            (payload.new as { session_id?: string })?.session_id ??
            (payload.old as { session_id?: string })?.session_id;
          if (rowSession !== sessionId) return;
          setIsBanned(payload.eventType !== "DELETE");
        },
      );
    channel.subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [sessionId, appUser?.id]);

  return { isBanned };
}
