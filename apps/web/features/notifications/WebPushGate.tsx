"use client";

import { useEffect, useRef } from "react";
import { useSession } from "@/features/auth/SessionProvider";
import { subscribeWebPush } from "@/lib/web-push";

// Headless gate: subscribe this browser to Web Push once the user is signed in
// (once per user). Mounted inside the protected layout's SessionProvider.
export function WebPushGate() {
  const { session, appUser } = useSession();
  const subscribedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!session || !appUser) return;
    if (subscribedFor.current === appUser.id) return;
    subscribedFor.current = appUser.id;
    void subscribeWebPush();
  }, [session, appUser]);

  return null;
}
