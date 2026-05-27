// Phase 9 — teacher-side view of who is currently muted in a session's chat.
//
// cb_read lets a session teacher SELECT every ban row for the session, and
// chat_bans is in the Realtime publication, so the live-control screen can
// offer an Unmute action whose label reflects the current ban state and
// updates the instant a ban is added or cleared. Writes still go through the
// audited chat-ban edge fn (D-172) — this hook is read-only.

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { withTimeout } from "@/features/auth/network-errors";

export function useSessionBans(sessionId: string | undefined): {
  bannedIds: Set<string>;
  isBanned: (userId: string | undefined) => boolean;
} {
  const [bannedIds, setBannedIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    if (!sessionId) return;
    const res = await withTimeout(
      supabase.from("chat_bans").select("user_id").eq("session_id", sessionId),
    );
    if (!res.error) {
      setBannedIds(
        new Set((res.data ?? []).map((r) => (r as { user_id: string }).user_id)),
      );
    }
  }, [sessionId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!sessionId) return;
    const channel = supabase.channel(`bans-${sessionId}`).on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "chat_bans",
        filter: `session_id=eq.${sessionId}`,
      },
      (payload) => {
        const uid =
          (payload.new as { user_id?: string })?.user_id ??
          (payload.old as { user_id?: string })?.user_id;
        if (!uid) return;
        setBannedIds((prev) => {
          const next = new Set(prev);
          if (payload.eventType === "DELETE") next.delete(uid);
          else next.add(uid);
          return next;
        });
      },
    );
    channel.subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [sessionId]);

  const isBanned = useCallback(
    (userId: string | undefined) => (userId ? bannedIds.has(userId) : false),
    [bannedIds],
  );

  return { bannedIds, isBanned };
}
