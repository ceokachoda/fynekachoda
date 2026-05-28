"use client";

// Phase 4 (Web) — live-class chat over Postgres CDC. Mirrors mobile features/
// chat/useChatChannel.ts.
//
// Loads message history, then subscribes to INSERT (new) + UPDATE (soft-delete)
// — cm_read does NOT gate on is_deleted so soft-deletes propagate live. On
// re-subscribe (e.g. network drop → reconnect), reloads history once since
// Realtime does NOT replay missed INSERTs (Phase-9 reconnect-reload fix).
//
// Posting is a DIRECT RLS-protected INSERT. The BEFORE-INSERT trigger stamps
// author_name / author_role and enforces the 5/30s rate limit; a ban is
// enforced by the cm_insert policy (the insert simply errors). The client
// MUST NOT send author_name (the trigger overrides it).

import { useCallback, useEffect, useMemo, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useSession } from "@/features/auth/SessionProvider";

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
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
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
    const res = await supabase
      .from("chat_messages")
      .select(SELECT_COLS)
      .eq("session_id", sessionId)
      .order("posted_at", { ascending: true })
      .limit(MAX_MESSAGES);
    if (res.error) {
      setError(res.error.message);
      setIsLoading(false);
      return;
    }
    setMessages((res.data ?? []) as unknown as ChatMessage[]);
    setIsLoading(false);
  }, [sessionId, supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!sessionId) return;
    const channel: RealtimeChannel = supabase.channel(`chat-${sessionId}`, {
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
        if (subscribedBefore) void load();
        else subscribedBefore = true;
      }
    });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [sessionId, appUser?.id, presence, supabase, load]);

  const post = useCallback(
    async (body: string, kind: "chat" | "announcement" = "chat") => {
      if (!sessionId || !appUser?.id) {
        return { ok: false, error: "Not signed in." };
      }
      const trimmed = body.trim();
      if (!trimmed) return { ok: false, error: "Message is empty." };
      if (trimmed.length > 500) {
        return { ok: false, error: "Message too long (max 500 characters)." };
      }
      const res = await supabase.from("chat_messages").insert({
        session_id: sessionId,
        author_id: appUser.id,
        body: trimmed,
        kind,
      });
      if (res.error) return { ok: false, error: res.error.message };
      return { ok: true };
    },
    [sessionId, appUser?.id, supabase],
  );

  return { messages, isLoading, error, presenceCount, post, reload: load };
}
