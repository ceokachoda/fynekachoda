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
