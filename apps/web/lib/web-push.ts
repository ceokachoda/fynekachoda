"use client";

// Browser-side Web Push subscription helpers.
//
// subscribeWebPush(): asks notification permission, creates (or reuses) a
// PushSubscription against the service worker, and registers it server-side via
// the `push-register` edge fn. unsubscribeWebPush(): the inverse, for sign-out.
//
// Everything is best-effort and guarded: no SW (dev, where serwist is disabled),
// denied permission, or an unsupported browser all resolve to a quiet no-op.

import { env } from "@/lib/env";
import { invokeEdgeFn } from "@/lib/edge-fn";

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  // Explicit ArrayBuffer backing so the result is BufferSource-assignable
  // (applicationServerKey rejects a possibly-SharedArrayBuffer-backed view).
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function webPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

// Resolve the active SW registration, but never hang forever (in dev there is
// no SW and `navigator.serviceWorker.ready` never resolves).
async function readyRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!webPushSupported()) return null;
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000));
  return Promise.race([navigator.serviceWorker.ready, timeout]);
}

export async function subscribeWebPush(): Promise<boolean> {
  try {
    const reg = await readyRegistration();
    if (!reg) return false;

    if (Notification.permission === "denied") return false;
    if (Notification.permission === "default") {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return false;
    }

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(env.vapidPublicKey),
      });
    }

    const json = sub.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return false;

    const res = await invokeEdgeFn("push-register", {
      kind: "web",
      subscription: {
        endpoint: json.endpoint,
        keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
      },
    });
    return res.status === 200;
  } catch {
    return false;
  }
}

export async function unsubscribeWebPush(): Promise<void> {
  try {
    const reg = await readyRegistration();
    if (!reg) return;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;
    const endpoint = sub.endpoint;
    await invokeEdgeFn("push-unregister", { kind: "web", endpoint });
    await sub.unsubscribe();
  } catch {
    // best-effort
  }
}
