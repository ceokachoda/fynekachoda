"use client";

import { memo, useEffect, useMemo, useRef } from "react";
import type { ChatMessage } from "@/features/chat/useChatChannel";
import { MessageBubble } from "./ChatPane";
import {
  messagesUpTo,
  withReplayOffsets,
} from "@/features/live/chat-replay";

type ReplayMsg = ChatMessage & { offsetSec: number };

interface ChatReplayProps {
  messages: ChatMessage[];
  startedAt: string;
  currentSec: number;
}

// Memoized: the recording screen re-renders ~1×/s to update the position
// label, but it passes a whole-second `currentSec`, so this only re-renders
// when a new message is revealed (or the messages set changes).
export const ChatReplay = memo(function ChatReplay({
  messages,
  startedAt,
  currentSec,
}: ChatReplayProps) {
  const listRef = useRef<HTMLDivElement>(null);

  const withOffsets = useMemo<ReplayMsg[]>(
    () =>
      withReplayOffsets(
        // chat + teacher announcements replay inline; system + soft-deleted are skipped.
        messages.filter((m) => m.kind !== "system" && !m.is_deleted),
        startedAt,
      ) as ReplayMsg[],
    [messages, startedAt],
  );

  const visible = useMemo(
    () => messagesUpTo(withOffsets, currentSec),
    [withOffsets, currentSec],
  );

  useEffect(() => {
    if (visible.length === 0) return;
    const t = setTimeout(() => {
      const el = listRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    }, 50);
    return () => clearTimeout(t);
  }, [visible.length]);

  if (visible.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-6">
        <p className="text-center text-sm text-slate-400">
          Chat from the class will replay here as the video plays.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={listRef}
      data-testid="chat-replay"
      className="h-full overflow-y-auto p-4"
    >
      {visible.map((item) => (
        <MessageBubble key={item.id} msg={item} />
      ))}
    </div>
  );
});
