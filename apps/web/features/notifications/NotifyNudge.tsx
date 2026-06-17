"use client";

// Gentle, dismissible dashboard banner that converts students who never granted
// (or dismissed) the notification prompt. Hidden once granted, unsupported, or
// dismissed for this session. This is the main lever to get the batch's
// already-signed-in-but-unsubscribed students receiving pushes.

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWebPushStatus } from "@/features/notifications/useWebPushStatus";

const DISMISS_KEY = "fyne_notify_nudge_dismissed";

export function NotifyNudge() {
  const { permission, busy, supported, enable } = useWebPushStatus();
  const [dismissed, setDismissed] = useState(true); // default hidden until mount

  useEffect(() => {
    setDismissed(sessionStorage.getItem(DISMISS_KEY) === "1");
  }, []);

  // Nothing to do when already on, unavailable, or dismissed this session.
  if (!supported || permission === "granted" || dismissed) return null;

  const dismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  };

  const denied = permission === "denied";

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-blue-100 bg-blue-50/70 p-3.5">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
        <Bell className="size-4 text-primary" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-slate-900">Turn on notifications</p>
        <p className="text-xs leading-snug text-slate-500">
          Get alerted when a class goes live or new material drops.
        </p>
      </div>
      {denied ? (
        <Button asChild size="sm" variant="outline" className="shrink-0">
          <Link href="/notifications">How</Link>
        </Button>
      ) : (
        <Button
          type="button"
          size="sm"
          className="shrink-0"
          disabled={busy}
          onClick={() => void enable()}
        >
          {busy ? "Enabling…" : "Enable"}
        </Button>
      )}
      <button
        type="button"
        aria-label="Dismiss"
        onClick={dismiss}
        className="-mr-1 shrink-0 rounded-md p-1 text-slate-400 hover:bg-blue-100 hover:text-slate-600"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
