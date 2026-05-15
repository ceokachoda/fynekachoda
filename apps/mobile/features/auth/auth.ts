import { supabase } from "@/lib/supabase";
import {
  isNetworkError,
  NETWORK_ERROR_MESSAGE,
  withTimeout,
} from "./network-errors";

export { isNetworkError } from "./network-errors";

export type AuthResult =
  | { ok: true }
  | { ok: false; error: string; suspended?: boolean };

// 30s for auth calls — iOS Expo Go can be slow writing the session into the
// Keychain after the /token response arrives, blocking the supabase-js
// promise well past the 15s default. The auth /token endpoint itself
// typically returns in <200ms; the delay is post-response storage work.
const AUTH_TIMEOUT_MS = 30_000;

async function sessionLanded(): Promise<boolean> {
  try {
    const { data } = await supabase.auth.getSession();
    return Boolean(data.session);
  } catch {
    return false;
  }
}

export async function signInWithPassword(
  email: string,
  password: string,
): Promise<AuthResult> {
  try {
    const { error } = await withTimeout(
      supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      }),
      AUTH_TIMEOUT_MS,
    );
    if (!error) return { ok: true };
    if (isNetworkError(error)) {
      // Server logs show /token returning 200 even when our promise times out
      // — the response can land after withTimeout fires. Check for a stashed
      // session before surfacing the network error.
      if (await sessionLanded()) return { ok: true };
      return { ok: false, error: NETWORK_ERROR_MESSAGE };
    }
    return { ok: false, error: "Invalid email or password." };
  } catch (err) {
    if (isNetworkError(err)) {
      if (await sessionLanded()) return { ok: true };
      return { ok: false, error: NETWORK_ERROR_MESSAGE };
    }
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

// Single edge-fn call. Server-side admin.auth.updateUserById changes the
// password AND clears must_change_password AND writes the audit row. Avoids
// the iOS Expo Go fetch-drop bug that hit us in CP9/CP10 — calling
// supabase.auth.updateUser from mobile rotates the session JWT, and the next
// RN fetch in the same screen silently dies before reaching the wire.
// See memory `auth-client-timeouts`.
export async function changeOwnPassword(
  newPassword: string,
): Promise<AuthResult> {
  try {
    const { data, error } = await withTimeout(
      supabase.functions.invoke("auth-change-own-password", {
        body: { new_password: newPassword },
      }),
    );
    if (error) {
      if (isNetworkError(error)) {
        return { ok: false, error: NETWORK_ERROR_MESSAGE };
      }
      const msg =
        (data && typeof data === "object" && "error" in data
          ? String((data as { error: unknown }).error)
          : null) ??
        (error as { message?: string }).message ??
        "Couldn't change password.";
      return { ok: false, error: msg };
    }
    return { ok: true };
  } catch (err) {
    if (isNetworkError(err)) {
      return { ok: false, error: NETWORK_ERROR_MESSAGE };
    }
    return { ok: false, error: "Something went wrong saving your password." };
  }
}

// Always returns ok:true on non-network outcomes. Two reasons:
//   1. Email enumeration: surfacing "this email doesn't exist" lets attackers
//      probe the user list. Standard pattern is "if an account exists, we've
//      sent a link" (GitHub, Google, etc.).
//   2. Supabase rejects reset requests to reserved test domains (.example.com,
//      .test, etc.) which would surface a confusing "invalid email" to demo
//      users with seed-data accounts.
// Network errors still surface so the user knows to retry.
export async function requestPasswordReset(email: string): Promise<AuthResult> {
  try {
    const { error } = await withTimeout(
      supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: "fynestudy://reset",
      }),
    );
    if (error && isNetworkError(error)) {
      return { ok: false, error: NETWORK_ERROR_MESSAGE };
    }
    return { ok: true };
  } catch (err) {
    if (isNetworkError(err)) {
      return { ok: false, error: NETWORK_ERROR_MESSAGE };
    }
    return { ok: true };
  }
}

// After the email-link reset puts the user in a recovery session, use the
// same single-call edge fn so the must_change_password flag is also cleared
// in one round-trip.
export async function setPasswordAfterReset(
  newPassword: string,
): Promise<AuthResult> {
  return await changeOwnPassword(newPassword);
}

export async function signOut(): Promise<void> {
  try {
    await withTimeout(supabase.auth.signOut());
  } catch {
    // Sign-out is best-effort. If the network call fails or times out, the
    // local session is still cleared by supabase-js so the next splash
    // routes to /login.
  }
}
