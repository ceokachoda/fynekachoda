// Typed edge-fn invoker that exposes HTTP status (needed for 409 replay,
// 423 locked, etc. — supabase.functions.invoke swallows non-2xx into an
// opaque Error). 15s timeout matches the data-call budget (D-148).
//
// Stale-session recovery (2026-06-14):
// A JWT whose GoTrue session was deleted server-side — the 2026-06-02 data
// reset, an admin suspend, a password reset on another device — is still validly
// *signed* and unexpired, so `getSession()` keeps handing it back and direct
// PostgREST reads succeed (the live screen even shows the "LIVE" badge). But
// every edge fn calls `auth.getUser()`, which ALSO checks the session row still
// exists, so it returns 401 "invalid token". auth-js only discovers the dead
// session at startup or when the access token finally expires, so until then the
// app sits on a poison token: live playback never signs, recordings show "invalid
// token". So on a 401 we force a single `refreshSession()`. If it succeeds (the
// ordinary token-rotation case) we retry with the fresh token; if it fails the
// session is genuinely gone, so we sign out locally and let the auth router send
// the user to /login for a fresh session.

import { supabase } from "./supabase";
import { env } from "./env";
import { isNetworkError, withTimeout } from "@/features/auth/network-errors";

// A refresh can fail two very different ways. Only a genuinely dead session —
// the refresh token was revoked, reused, not found, or the user no longer
// exists — should log the user out. A network/timeout failure is transient and
// must NOT sign them out: the still-valid session will work again on the next
// call. We sign out ONLY on these known-fatal signatures (anything unrecognised
// is treated as transient, erring toward keeping the user signed in).
const FATAL_AUTH = new RegExp(
  [
    "invalid refresh token",
    "refresh token not found",
    "refresh_token_not_found",
    "refresh_token_already_used",
    "session[ _]not[ _]found",
    "session_not_found",
    "user[ _]not[ _]found",
    "user_not_found",
    "user_banned",
    "bad_jwt",
  ].join("|"),
  "i",
);

function isFatalAuthError(error: unknown): boolean {
  if (!error) return false;
  // A network/timeout failure is retryable, never fatal.
  if (isNetworkError(error)) return false;
  const e = error as { message?: unknown; code?: unknown };
  const code = typeof e.code === "string" ? e.code : "";
  const msg = typeof e.message === "string" ? e.message : "";
  return FATAL_AUTH.test(code) || FATAL_AUTH.test(msg);
}

const FUNCTIONS_BASE = `${env.supabaseUrl.replace(/\/+$/, "")}/functions/v1`;

export interface EdgeFnResult<T> {
  status: number;
  body: T | null;
  error: string | null;
}

async function postOnce<T>(
  name: string,
  body: unknown,
  token: string,
): Promise<EdgeFnResult<T>> {
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
}

// De-duped session recovery: many hooks fire edge calls at once (the live screen
// alone re-signs every 5s), so a dead session would otherwise trigger N parallel
// refreshes — which can race into refresh-token-reuse detection and revoke the
// session for real. One in-flight refresh, shared by every caller.
let inflightRecovery: Promise<string | null> | null = null;

async function recover(): Promise<string | null> {
  const { data, error } = await supabase.auth.refreshSession();
  if (!error && data.session?.access_token) return data.session.access_token;
  // Only a genuinely dead session warrants a local sign-out (→ auth router sends
  // the user to /login; `scope: 'local'` skips the doomed server round-trip). A
  // transient network failure during the refresh must NOT log the user out — we
  // return null so this one edge call fails and the next call retries against
  // the still-valid session.
  if (isFatalAuthError(error)) {
    await supabase.auth.signOut({ scope: "local" }).catch(() => {});
  }
  return null;
}

function recoverOnce(): Promise<string | null> {
  if (!inflightRecovery) {
    inflightRecovery = recover().finally(() => {
      inflightRecovery = null;
    });
  }
  return inflightRecovery;
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
    const first = await postOnce<T>(name, body, token);
    if (first.status !== 401) return first;

    // 401: the session may be dead server-side. Recover once, then retry.
    const fresh = await recoverOnce();
    if (!fresh) return first; // signed out → auth router takes over
    return await postOnce<T>(name, body, fresh);
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
