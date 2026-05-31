"use client";

import { memo, useEffect, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/features/chat/useChatChannel";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "·";
  const first = parts[0]![0] ?? "";
  const second = parts.length > 1 ? parts[parts.length - 1]![0] ?? "" : "";
  return (first + second).toUpperCase();
}

function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface MessageBubbleProps {
  msg: ChatMessage;
  isOwn?: boolean;
  onModerate?: () => void;
}

// Memoized: a live class re-renders the whole pane on every incoming message
// and the per-second player tick. With a stable `msg` (keyed by id) an existing
// bubble never re-runs its initials()/Date formatting again — only the newly
// added bubble renders.
export const MessageBubble = memo(function MessageBubble({
  msg,
  isOwn,
  onModerate,
}: MessageBubbleProps) {
  const isStaff = msg.author_role === "teacher" || msg.author_role === "admin";
  const moderate = onModerate
    ? (
        <button
          type="button"
          onClick={onModerate}
          className="ml-2 rounded px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          aria-label="Moderate message"
        >
          ⋯
        </button>
      )
    : null;
  return (
    <div className="mb-3 flex">
      <div
        className={cn(
          "mr-2 mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full",
          isStaff ? "bg-emerald-100" : "bg-blue-100",
        )}
      >
        <span
          className={cn(
            "text-[10px] font-bold",
            isStaff ? "text-emerald-700" : "text-blue-700",
          )}
        >
          {initials(msg.author_name)}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex items-center">
          <span
            className={cn(
              "mr-2 truncate text-xs font-bold",
              isStaff ? "text-emerald-700" : "text-slate-800",
            )}
          >
            {msg.author_name}
            {isOwn ? " (you)" : ""}
          </span>
          {isStaff ? (
            <span className="mr-2 rounded bg-emerald-600 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-white">
              {msg.author_role === "admin" ? "Admin" : "Teacher"}
            </span>
          ) : null}
          <span className="text-[10px] text-slate-400">
            {timeOf(msg.posted_at)}
          </span>
          {moderate}
        </div>
        <p className="text-sm leading-5 text-slate-700">{msg.body}</p>
      </div>
    </div>
  );
});

interface ChatPaneProps {
  messages: ChatMessage[];
  currentUserId?: string;
  canModerate?: boolean;
  onModerate?: (msg: ChatMessage) => void;
  emptyHint?: string;
}

export function ChatPane({
  messages,
  currentUserId,
  canModerate,
  onModerate,
  emptyHint,
}: ChatPaneProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const data = useMemo(
    () => messages.filter((m) => m.kind === "chat" && !m.is_deleted),
    [messages],
  );

  useEffect(() => {
    if (data.length === 0) return;
    const t = setTimeout(() => {
      const el = listRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    }, 50);
    return () => clearTimeout(t);
  }, [data.length]);

  if (data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-6">
        <p className="text-center text-sm text-slate-400">
          {emptyHint ?? "No messages yet. Say hello!"}
        </p>
      </div>
    );
  }

  return (
    <div
      ref={listRef}
      data-testid="chat-pane"
      className="h-full overflow-y-auto p-4"
    >
      {data.map((item) => (
        <MessageBubble
          key={item.id}
          msg={item}
          isOwn={item.author_id === currentUserId}
          onModerate={canModerate ? () => onModerate?.(item) : undefined}
        />
      ))}
    </div>
  );
}
