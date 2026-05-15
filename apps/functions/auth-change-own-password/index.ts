import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { handlePreflight } from "../_shared/cors.ts";
import { json, jsonError } from "../_shared/response.ts";
import { getServiceRoleClient } from "../_shared/supabase.ts";
import { AuthError, loadCaller } from "../_shared/auth.ts";
import { clientIp, writeAudit } from "../_shared/audit.ts";
import { ChangeOwnPasswordInputSchema } from "../_shared/schemas.ts";

// Single-call replacement for the old two-step
//   1) supabase.auth.updateUser({ password })
//   2) supabase.functions.invoke("auth-clear-must-change")
// pattern. On iOS Expo Go, supabase.auth.updateUser silently rotates the
// session and the very next RN fetch (whether raw or via functions.invoke)
// can be dropped by the platform before it reaches the wire. Collapsing the
// two operations into one server-side admin call means the client only makes
// one round-trip and never calls auth.updateUser — see
// memory `auth-client-timeouts`.
//
// Auth: caller must be signed in (valid JWT, is_active=true). They can only
// change their OWN password; nothing in the payload identifies a target user.

Deno.serve(async (req: Request) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  const origin = req.headers.get("Origin");

  if (req.method !== "POST") return jsonError(405, "method not allowed", origin);

  try {
    const caller = await loadCaller(req);

    const rawBody = await req.json().catch(() => null);
    if (rawBody === null) return jsonError(400, "invalid JSON body", origin);

    const parsed = ChangeOwnPasswordInputSchema.safeParse(rawBody);
    if (!parsed.success) {
      return jsonError(400, "validation failed", origin, parsed.error.issues);
    }
    const { new_password } = parsed.data;

    if (new_password.toLowerCase() === caller.email.toLowerCase()) {
      return jsonError(400, "password cannot match your email", origin);
    }

    const admin = getServiceRoleClient();

    const { data: before, error: lookupErr } = await admin
      .from("app_users")
      .select("id, must_change_password")
      .eq("id", caller.app_user_id)
      .single();
    if (lookupErr || !before) {
      return jsonError(500, "lookup failed", origin, lookupErr?.message);
    }

    const { error: pwErr } = await admin.auth.admin.updateUserById(
      caller.auth_user_id,
      { password: new_password },
    );
    if (pwErr) {
      return jsonError(500, "password update failed", origin, pwErr.message);
    }

    if (before.must_change_password) {
      const { error: flagErr } = await admin
        .from("app_users")
        .update({ must_change_password: false })
        .eq("id", caller.app_user_id);
      if (flagErr) {
        return jsonError(500, "flag update failed", origin, flagErr.message);
      }
    }

    await writeAudit(admin, {
      actor_user_id: caller.app_user_id,
      actor_role: caller.roles[0] ?? null,
      action: "password_changed",
      entity_table: "app_users",
      entity_id: caller.app_user_id,
      before_data: { must_change_password: before.must_change_password },
      after_data: { must_change_password: false },
      ip_address: clientIp(req),
      user_agent: req.headers.get("user-agent"),
    });

    return json(
      200,
      {
        user_id: caller.app_user_id,
        must_change_password: false,
      },
      origin,
    );
  } catch (err) {
    if (err instanceof AuthError) {
      return jsonError(err.status, err.message, origin);
    }
    console.error("auth-change-own-password error:", err);
    return jsonError(500, "internal error", origin);
  }
});
