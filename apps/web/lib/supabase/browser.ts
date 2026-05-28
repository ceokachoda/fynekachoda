"use client";

import { createBrowserClient } from "@supabase/ssr";
import { env } from "@/lib/env";

// detectSessionInUrl is on by default in @supabase/ssr's browser client — it
// reads the recovery / magic-link hash and writes the session cookie. We rely
// on this for /reset (the email link returns to `${origin}/reset#access_token=…`).
let _client: ReturnType<typeof createBrowserClient> | null = null;

export function createSupabaseBrowserClient() {
  if (_client) return _client;
  _client = createBrowserClient(env.supabaseUrl, env.supabaseAnonKey);
  return _client;
}
