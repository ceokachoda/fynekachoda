import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { handlePreflight } from "../_shared/cors.ts";
import { json, jsonError } from "../_shared/response.ts";
import { getServiceRoleClient } from "../_shared/supabase.ts";
import { AuthError, adminRoleFor, loadCaller, requireAnyRole } from "../_shared/auth.ts";
import { clientIp, writeAudit } from "../_shared/audit.ts";
import { generateTempPassword } from "../_shared/password.ts";
import { ForceResetInputSchema } from "../_shared/schemas.ts";

Deno.serve(async (req: Request) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  const origin = req.headers.get("Origin");

  if (req.method !== "POST") return jsonError(405, "method not allowed", origin);

  try {
    const caller = await loadCaller(req);
    requireAnyRole(caller, ["owner_admin", "staff_admin"]);

    const rawBody = await req.json().catch(() => null);
    if (rawBody === null) return jsonError(400, "invalid JSON body", origin);

    const parsed = ForceResetInputSchema.safeParse(rawBody);
    if (!parsed.success) {
      return jsonError(400, "validation failed", origin, parsed.error.issues);
    }
    const { user_id } = parsed.data;

    if (user_id === caller.app_user_id) {
      return jsonError(
        400,
        "use the regular password change for your own account",
        origin,
      );
    }

    const admin = getServiceRoleClient();

    const { data: before, error: lookupErr } = await admin
      .from("app_users")
      .select("id, auth_user_id, full_name, email, must_change_password")
      .eq("id", user_id)
      .maybeSingle();
    if (lookupErr) return jsonError(500, "lookup failed", origin, lookupErr.message);
    if (!before) return jsonError(404, "user not found", origin);

    const newPassword = generateTempPassword();

    const { error: pwErr } = await admin.auth.admin.updateUserById(
      before.auth_user_id,
      { password: newPassword },
    );
    if (pwErr) {
      return jsonError(500, "password update failed", origin, pwErr.message);
    }

    const { data: updated, error: flagErr } = await admin
      .from("app_users")
      .update({ must_change_password: true })
      .eq("id", user_id)
      .select("id, must_change_password")
      .single();
    if (flagErr || !updated) {
      return jsonError(500, "flag update failed", origin, flagErr?.message);
    }

    const { error: signOutErr } = await admin.auth.admin.signOut(
      before.auth_user_id,
    );
    if (signOutErr) console.error("admin.signOut failed:", signOutErr.message);

    await writeAudit(admin, {
      actor_user_id: caller.app_user_id,
      actor_role: adminRoleFor(caller),
      action: "force_reset_password",
      entity_table: "app_users",
      entity_id: user_id,
      before_data: { must_change_password: before.must_change_password },
      after_data: { must_change_password: true },
      ip_address: clientIp(req),
      user_agent: req.headers.get("user-agent"),
    });

    return json(
      200,
      {
        user_id,
        email: before.email,
        initial_password: newPassword,
      },
      origin,
    );
  } catch (err) {
    if (err instanceof AuthError) {
      return jsonError(err.status, err.message, origin);
    }
    console.error("auth-force-reset error:", err);
    return jsonError(500, "internal error", origin);
  }
});
