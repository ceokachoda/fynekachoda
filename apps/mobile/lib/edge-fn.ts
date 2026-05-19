// Typed edge-fn invoker that exposes HTTP status (needed for 409 replay,
// 423 locked, etc. — supabase.functions.invoke swallows non-2xx into an
// opaque Error). 15s timeout matches the data-call budget (D-148).

import { supabase } from "./supabase";
import { env } from "./env";
import { withTimeout } from "@/features/auth/network-errors";

const FUNCTIONS_BASE = `${env.supabaseUrl.replace(/\/+$/, "")}/functions/v1`;

export interface EdgeFnResult<T> {
  status: number;
  body: T | null;
  error: string | null;
}

export async function invokeEdgeFn<T>(
  name: string,
  body: unknown,
): Promise<EdgeFnResult<T>> {
  try {
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

// Same as `invokeEdgeFn` but does NOT attach Authorization. Used by
// `server-time` which is intentionally public.
export async function invokeEdgeFnPublic<T>(
  name: string,
  body: unknown,
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
