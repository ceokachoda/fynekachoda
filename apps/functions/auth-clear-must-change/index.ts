import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { handlePreflight } from "../_shared/cors.ts";
import { json, jsonError } from "../_shared/response.ts";
import { getServiceRoleClient } from "../_shared/supabase.ts";
import { AuthError, loadCaller } from "../_shared/auth.ts";
import { clientIp, writeAudit } from "../_shared/audit.ts";

// Called by the mobile app immediately after the user runs
// supabase.auth.updateUser({ password }) on the force-password-change screen.
// Flips the must_change_password flag and writes the audit row in one place.
// No body is required.

Deno.serve(async (req: Request) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  const origin = req.headers.get("Origin");

  if (req.method !== "POST") return jsonError(405, "method not allowed", origin);

  try {
    const caller = await loadCaller(req);
    const admin = getServiceRoleClient();

    const { data: before, error: lookupErr } = await admin
      .from("app_users")
      .select("id, must_change_password")
      .eq("id", caller.app_user_id)
      .single();
    if (lookupErr) {
      return jsonError(500, "lookup failed", origin, lookupErr.message);
    }

    if (!before.must_change_password) {
      // Idempotent: already cleared.
      return json(
        200,
        { user_id: caller.app_user_id, must_change_password: false },
        origin,
      );
    }

    const { data: updated, error: updErr } = await admin
      .from("app_users")
      .update({ must_change_password: false })
      .eq("id", caller.app_user_id)
      .select("id, must_change_password")
      .single();
    if (updErr || !updated) {
      return jsonError(500, "update failed", origin, updErr?.message);
    }

    await writeAudit(admin, {
      actor_user_id: caller.app_user_id,
      actor_role: caller.roles[0] ?? null,
      action: "password_changed",
      entity_table: "app_users",
      entity_id: caller.app_user_id,
      before_data: { must_change_password: true },
      after_data: { must_change_password: false },
      ip_address: clientIp(req),
      user_agent: req.headers.get("user-agent"),
    });

    return json(
      200,
      { user_id: caller.app_user_id, must_change_password: false },
      origin,
    );
  } catch (err) {
    if (err instanceof AuthError) {
      return jsonError(err.status, err.message, origin);
    }
    console.error("auth-clear-must-change error:", err);
    return jsonError(500, "internal error", origin);
  }
});
