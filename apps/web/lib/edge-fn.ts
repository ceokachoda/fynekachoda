"use client";

// Browser-side edge-function invoker. Preserves non-2xx HTTP status (the mobile
// edge-fn callers rely on 401/403/409/423/429 etc. — supabase.functions.invoke
// hides them behind opaque errors). 15s timeout matches mobile (D-148).

import { env } from "@/lib/env";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

const FUNCTIONS_BASE = `${env.supabaseUrl.replace(/\/+$/, "")}/functions/v1`;
const DEFAULT_TIMEOUT_MS = 15_000;

export interface EdgeFnResult<T> {
  status: number;
  body: T | null;
  error: string | null;
}

function withTimeout<T>(p: Promise<T>, ms: number = DEFAULT_TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("Request timed out")), ms);
  });
  return Promise.race([p, timeoutPromise]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

export async function invokeEdgeFn<T>(
  name: string,
  body: unknown,
  options: { timeoutMs?: number } = {},
): Promise<EdgeFnResult<T>> {
  try {
    const supabase = createSupabaseBrowserClient();
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      return { status: 401, body: null, error: "no session" };
    }
    const res = await withTimeout(
      fetch(`${FUNCTIONS_BASE}/${name}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          apikey: env.supabaseAnonKey,
        },
        body: JSON.stringify(body),
      }),
      options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    );
    let parsed: unknown = null;
    try {
      const text = await res.text();
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = null;
    }
    return { status: res.status, body: parsed as T, error: null };
  } catch (e) {
    return {
      status: 0,
      body: null,
      error: e instanceof Error ? e.message : "network error",
    };
  }
}

// Same as invokeEdgeFn but does NOT attach Authorization — for public fns
// like `server-time`.
export async function invokeEdgeFnPublic<T>(
  name: string,
  body: unknown,
  options: { timeoutMs?: number } = {},
): Promise<EdgeFnResult<T>> {
  try {
    const res = await withTimeout(
      fetch(`${FUNCTIONS_BASE}/${name}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: env.supabaseAnonKey,
        },
        body: JSON.stringify(body),
      }),
      options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    );
    let parsed: unknown = null;
    try {
      const text = await res.text();
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = null;
    }
    return { status: res.status, body: parsed as T, error: null };
  } catch (e) {
    return {
      status: 0,
      body: null,
      error: e instanceof Error ? e.message : "network error",
    };
  }
}
