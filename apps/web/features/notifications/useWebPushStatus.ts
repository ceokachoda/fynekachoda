"use client";

// Client hook that exposes this browser's Web Push state and a one-tap enable.
//
// `WebPushGate` already auto-subscribes once per signed-in user, but the browser
// only shows its native permission prompt ONCE (and never again if the user
// dismissed/blocked it). This hook backs the visible "Enable notifications"
// affordances (the /notifications page + dashboard nudge) so a student who said
// "no" — or never saw the prompt — can turn pushes on with an explicit tap.

import { useCallback, useEffect, useState } from "react";
import { subscribeWebPush, webPushSupported } from "@/lib/web-push";

export type PushPermission = "unsupported" | "default" | "granted" | "denied";

export interface WebPushStatus {
  /** Current browser permission, or "unsupported" when Web Push is unavailable. */
  permission: PushPermission;
  /** True while an enable() round-trip is in flight. */
  busy: boolean;
  /** Whether this browser can do Web Push at all (false on e.g. iOS Safari tab). */
  supported: boolean;
  /** Re-read the live permission (cheap; safe to call on focus). */
  refresh: () => void;
  /**
   * Prompt + subscribe. No-op when unsupported. When already "denied" the OS
   * won't re-prompt, so the caller should point the user at browser settings.
   */
  enable: () => Promise<void>;
}

function readPermission(): PushPermission {
  if (!webPushSupported()) return "unsupported";
  return Notification.permission as PushPermission;
}

export function useWebPushStatus(): WebPushStatus {
  // SSR-safe default; the real value is read on mount (client only).
  const [permission, setPermission] = useState<PushPermission>("default");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    setPermission(readPermission());
  }, []);

  useEffect(() => {
    refresh();
    // Some browsers fire a Permissions change event; reflect it live.
    let cancelled = false;
    if (typeof navigator !== "undefined" && navigator.permissions?.query) {
      navigator.permissions
        .query({ name: "notifications" as PermissionName })
        .then((status) => {
          if (cancelled) return;
          status.onchange = () => refresh();
        })
        .catch(() => {
          /* Permissions API unavailable for 'notifications' — ignore. */
        });
    }
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const enable = useCallback(async () => {
    if (!webPushSupported()) return;
    setBusy(true);
    try {
      await subscribeWebPush();
    } finally {
      refresh();
      setBusy(false);
    }
  }, [refresh]);

  return {
    permission,
    busy,
    supported: permission !== "unsupported",
    refresh,
    enable,
  };
}
