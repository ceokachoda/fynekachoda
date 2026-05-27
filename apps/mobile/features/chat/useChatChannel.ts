// Phase 9 CP10 — live-class chat over Postgres CDC.
//
// Loads the message history, then subscribes to INSERT (new messages) +
// UPDATE (soft-deletes propagate, since cm_read does NOT gate on is_deleted).
// Optionally tracks Realtime presence so the teacher's live-control can show a
// viewer count. Unsubscribes on unmount (no ghost channels). Posting is a
// direct RLS-protected insert — the BEFORE-INSERT trigger stamps author_name/
// role and enforces the 5/30s rate limit; a ban is enforced by the cm_insert
// policy (the insert simply errors).

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/features/auth/useSession";
import {
  isNetworkError,
  NETWORK_ERROR_MESSAGE,
  withTimeout,
} from "@/features/auth/network-errors";

export type ChatKind = "chat" | "announcement" | "system";

export interface ChatMessage {
  id: string;
  session_id: string;
  author_id: string;
  author_name: string;
  author_role: string;
  kind: ChatKind;
  body: string;
  is_deleted: boolean;
  posted_at: string;
}

const MAX_MESSAGES = 200;
const SELECT_COLS =
  "id, session_id, author_id, author_name, author_role, kind, body, is_deleted, posted_at";

export interface ChatChannel {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  presenceCount: number;
  post: (
    body: string,
    kind?: "chat" | "announcement",
  ) => Promise<{ ok: boolean; error?: string }>;
  reload: () => Promise<void>;
}

export function useChatChannel(
  sessionId: string | undefined,
  opts?: { presence?: boolean },
): ChatChannel {
  const { appUser } = useSession();
  const presence = opts?.presence ?? false;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [presenceCount, setPresenceCount] = useState(0);

  const load = useCallback(async () => {
    if (!sessionId) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await withTimeout(
        supabase
          .from("chat_messages")
          .select(SELECT_COLS)
          .eq("session_id", sessionId)
          .order("posted_at", { ascending: true })
          .limit(MAX_MESSAGES),
      );
      if (res.error) {
        setError(res.error.message);
        return;
      }
      setMessages((res.data ?? []) as unknown as ChatMessage[]);
    } catch (err) {
      setError(isNetworkError(err) ? NETWORK_ERROR_MESSAGE : "Couldn't load chat.");
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!sessionId) return;
    const channel = supabase.channel(`chat-${sessionId}`, {
      config: { presence: { key: appUser?.id ?? "anon" } },
    });
    channel
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const row = payload.new as unknown as ChatMessage;
          setMessages((prev) =>
            prev.some((m) => m.id === row.id)
              ? prev
              : [...prev, row].slice(-MAX_MESSAGES),
          );
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "chat_messages",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const row = payload.new as unknown as ChatMessage;
          setMessages((prev) => prev.map((m) => (m.id === row.id ? row : m)));
        },
      );
    if (presence) {
      channel.on("presence", { event: "sync" }, () => {
        setPresenceCount(Object.keys(channel.presenceState()).length);
      });
    }
    let subscribedBefore = false;
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        if (presence && appUser?.id) {
          void channel.track({ uid: appUser.id, at: Date.now() });
        }
        // Realtime does NOT replay INSERTs missed while disconnected, so on a
        // RE-subscribe (e.g. after airplane mode) reload history to catch up.
        // The first SUBSCRIBED is skipped — the load effect already fetched it.
        if (subscribedBefore) void load();
        else subscribedBefore = true;
      }
    });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [sessionId, appUser?.id, presence, load]);

  const post = useCallback(
    async (body: string, kind: "chat" | "announcement" = "chat") => {
      if (!sessionId || !appUser?.id) return { ok: false, error: "Not signed in." };
      const trimmed = body.trim();
      if (!trimmed) return { ok: false, error: "Message is empty." };
      if (trimmed.length > 500) {
        return { ok: false, error: "Message too long (max 500 characters)." };
      }
      try {
        const res = await withTimeout(
          supabase
            .from("chat_messages")
            .insert({ session_id: sessionId, author_id: appUser.id, body: trimmed, kind }),
        );
        if (res.error) return { ok: false, error: res.error.message };
        return { ok: true };
      } catch (err) {
        return {
          ok: false,
          error: isNetworkError(err) ? NETWORK_ERROR_MESSAGE : "Couldn't send.",
        };
      }
    },
    [sessionId, appUser?.id],
  );

  return { messages, isLoading, error, presenceCount, post, reload: load };
}
