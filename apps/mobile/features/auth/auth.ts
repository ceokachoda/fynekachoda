import { supabase } from "@/lib/supabase";
import { env } from "@/lib/env";
import {
  DEFAULT_TIMEOUT_MS,
  isNetworkError,
  NETWORK_ERROR_MESSAGE,
  withTimeout,
} from "./network-errors";

export { isNetworkError } from "./network-errors";

export type AuthResult =
  | { ok: true }
  | { ok: false; error: string; suspended?: boolean };

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
    );
    if (error) {
      if (isNetworkError(error)) {
        return { ok: false, error: NETWORK_ERROR_MESSAGE };
      }
      return { ok: false, error: "Invalid email or password." };
    }
    return { ok: true };
  } catch (err) {
    if (isNetworkError(err)) {
      return { ok: false, error: NETWORK_ERROR_MESSAGE };
    }
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

// Two-step per spec §5.8: updateUser then auth-clear-must-change. The edge
// function flips must_change_password=false and writes the audit row.
export async function changeOwnPassword(
  newPassword: string,
): Promise<AuthResult> {
  try {
    const { error: updErr } = await withTimeout(
      supabase.auth.updateUser({ password: newPassword }),
    );
    if (updErr) {
      if (isNetworkError(updErr)) {
        return { ok: false, error: NETWORK_ERROR_MESSAGE };
      }
      return { ok: false, error: updErr.message };
    }
  } catch (err) {
    if (isNetworkError(err)) {
      return { ok: false, error: NETWORK_ERROR_MESSAGE };
    }
    throw err;
  }

  return await clearMustChange();
}

// Idempotent. Called after updateUser by both force-password-change and reset
// flows. AbortController gives us real cancellation on the fetch side so the
// request actually stops trying after the timeout (unlike supabase-js calls).
async function clearMustChange(): Promise<AuthResult> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return { ok: false, error: "Session lost while saving. Sign in again." };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const res = await fetch(
      `${env.supabaseUrl}/functions/v1/auth-clear-must-change`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
        signal: controller.signal,
      },
    );
    if (!res.ok) {
      return {
        ok: false,
        error: `Could not clear must-change flag (HTTP ${res.status}). Try again.`,
      };
    }
    return { ok: true };
  } catch (err) {
    if (isNetworkError(err)) {
      return { ok: false, error: NETWORK_ERROR_MESSAGE };
    }
    return { ok: false, error: "Something went wrong saving your password." };
  } finally {
    clearTimeout(timer);
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

// After the email-link reset succeeds, also clear must_change_password.
// A user who forgot their admin-issued temp password and reset via email
// would otherwise be bounced to /force-password-change after just changing
// it. auth-clear-must-change is idempotent so this is safe in both cases.
export async function setPasswordAfterReset(
  newPassword: string,
): Promise<AuthResult> {
  try {
    const { error } = await withTimeout(
      supabase.auth.updateUser({ password: newPassword }),
    );
    if (error) {
      if (isNetworkError(error)) {
        return { ok: false, error: NETWORK_ERROR_MESSAGE };
      }
      return { ok: false, error: error.message };
    }
  } catch (err) {
    if (isNetworkError(err)) {
      return { ok: false, error: NETWORK_ERROR_MESSAGE };
    }
    throw err;
  }

  return await clearMustChange();
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
