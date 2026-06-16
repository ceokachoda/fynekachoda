/// <reference lib="WebWorker" />
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist, NetworkOnly } from "serwist";

// Augment the SW global with the Serwist injection points.
declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope & {
  __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
};

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // NEVER cache Supabase (auth / PostgREST / edge fns / storage / realtime).
    // Authenticated + dynamic data must always hit the network — a stale cached
    // page still re-fetches its data (Phase 5 §E gotcha). This rule is FIRST so
    // it wins over any defaultCache cross-origin rule.
    {
      matcher: ({ url }) => url.hostname.endsWith(".supabase.co"),
      handler: new NetworkOnly(),
    },
    // Defaults: cache-first for static assets, network-first for navigations
    // (static app shell only — precacheEntries above).
    ...defaultCache,
  ],
});

serwist.addEventListeners();

// --- Web Push -----------------------------------------------------------------
// The backend (push-dispatch) sends a JSON body { title, body, data } where
// `data` carries a semantic { type, id?, session_id? } that we map to an in-app
// URL. Mapping lives here (the SW can't import app code) and must stay in sync
// with the backend `type` values + the web routes.
interface PushData {
  type?: string;
  id?: string;
  session_id?: string;
  kind?: string;
}

function routeForPush(data: PushData | undefined): string {
  if (!data || !data.type) return "/";
  switch (data.type) {
    case "live_started":
      return data.session_id ? `/live/${data.session_id}` : "/classes";
    case "class_scheduled":
    case "class_reminder":
      return "/classes";
    case "new_content":
      return "/library";
    case "new_quiz":
      return "/practice";
    case "new_exam":
    case "exam_results":
      return "/exams";
    default:
      return "/";
  }
}

self.addEventListener("push", (event: PushEvent) => {
  let payload: { title?: string; body?: string; data?: PushData } = {};
  try {
    payload = event.data?.json() ?? {};
  } catch {
    payload = { body: event.data?.text() };
  }
  const title = payload.title ?? "FyneStudy";
  const url = routeForPush(payload.data);
  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body ?? "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url, ...(payload.data ?? {}) },
    }),
  );
});

self.addEventListener("notificationclick", (event: NotificationEvent) => {
  event.notification.close();
  const target =
    (event.notification.data && (event.notification.data as { url?: string }).url) || "/";
  event.waitUntil(
    (async () => {
      const windowClients = (await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      })) as readonly WindowClient[];
      for (const client of windowClients) {
        // Focus an existing tab and navigate it to the target.
        await client.focus();
        try {
          await client.navigate(target);
        } catch {
          // cross-origin or detached — fall back to opening a new window.
        }
        return;
      }
      await self.clients.openWindow(target);
    })(),
  );
});
