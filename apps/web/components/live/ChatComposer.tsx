"use client";

import {
  type FormEvent,
  type KeyboardEvent,
  useRef,
  useState,
} from "react";
import { Loader2, Send } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatComposerProps {
  onSend: (text: string) => Promise<{ ok: boolean; error?: string }>;
  disabled?: boolean;
  disabledReason?: string;
  placeholder?: string;
}

export function ChatComposer({
  onSend,
  disabled,
  disabledReason,
  placeholder,
}: ChatComposerProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    if (sending || !text.trim()) return;
    setSending(true);
    setError(null);
    const res = await onSend(text);
    if (res.ok) {
      setText("");
      inputRef.current?.focus();
    } else {
      setError(res.error ?? "Couldn't send.");
    }
    setSending(false);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void send();
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter to send, Shift+Enter for newline.
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  if (disabled) {
    return (
      <div
        data-testid="chat-composer-disabled"
        className="border-t border-slate-200 bg-slate-100 px-4 py-3 text-center text-xs text-slate-500"
      >
        {disabledReason ?? "You can read the chat but can't send messages."}
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      data-testid="chat-composer"
      className="border-t border-slate-100 bg-slate-50"
    >
      {error ? (
        <div className="px-4 pt-2">
          <p className="text-xs text-red-600" role="alert">
            {error}
          </p>
        </div>
      ) : null}
      <div className="flex items-end gap-3 px-4 py-3">
        <div className="flex min-h-11 flex-1 items-center rounded-3xl border border-slate-200 bg-white px-4">
          <textarea
            ref={inputRef}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (error) setError(null);
            }}
            onKeyDown={onKeyDown}
            placeholder={placeholder ?? "Type a message…"}
            maxLength={500}
            rows={1}
            className="max-h-24 w-full resize-none border-0 bg-transparent py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={sending || !text.trim()}
          aria-label="Send message"
          className={cn(
            "flex size-11 items-center justify-center rounded-full text-white transition",
            text.trim() && !sending
              ? "bg-blue-600 hover:bg-blue-700"
              : "bg-slate-300 cursor-not-allowed",
          )}
        >
          {sending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="-ml-0.5 size-4" />
          )}
        </button>
      </div>
    </form>
  );
}
