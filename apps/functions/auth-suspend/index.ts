import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { handlePreflight } from "../_shared/cors.ts";
import { json, jsonError } from "../_shared/response.ts";
import { getServiceRoleClient } from "../_shared/supabase.ts";
import { AuthError, adminRoleFor, loadCaller, requireAnyRole } from "../_shared/auth.ts";
import { clientIp, writeAudit } from "../_shared/audit.ts";
import { SuspendInputSchema } from "../_shared/schemas.ts";

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

    const parsed = SuspendInputSchema.safeParse(rawBody);
    if (!parsed.success) {
      return jsonError(400, "validation failed", origin, parsed.error.issues);
    }
    const input = parsed.data;

    if (input.user_id === caller.app_user_id) {
      return jsonError(400, "cannot suspend/unsuspend yourself", origin);
    }

    const admin = getServiceRoleClient();

    const { data: before, error: lookupErr } = await admin
      .from("app_users")
      .select(
        "id, auth_user_id, full_name, email, is_active, suspended_at, suspended_reason",
      )
      .eq("id", input.user_id)
      .maybeSingle();
    if (lookupErr) return jsonError(500, "lookup failed", origin, lookupErr.message);
    if (!before) return jsonError(404, "user not found", origin);

    if (input.mode === "suspend") {
      if (!before.is_active) return jsonError(409, "already suspended", origin);

      const { data: updated, error: updErr } = await admin
        .from("app_users")
        .update({
          is_active: false,
          suspended_at: new Date().toISOString(),
          suspended_reason: input.reason ?? null,
        })
        .eq("id", input.user_id)
        .select("id, is_active, suspended_at, suspended_reason")
        .single();
      if (updErr || !updated) {
        return jsonError(500, "update failed", origin, updErr?.message);
      }

      const { error: signOutErr } = await admin.auth.admin.signOut(
        before.auth_user_id,
      );
      if (signOutErr) console.error("admin.signOut failed:", signOutErr.message);

      await writeAudit(admin, {
        actor_user_id: caller.app_user_id,
        actor_role: adminRoleFor(caller),
        action: "suspend_user",
        entity_table: "app_users",
        entity_id: input.user_id,
        before_data: before,
        after_data: updated,
        ip_address: clientIp(req),
        user_agent: req.headers.get("user-agent"),
      });

      return json(200, { user_id: input.user_id, is_active: false }, origin);
    }

    // unsuspend
    if (before.is_active) {
      return jsonError(409, "user is already active", origin);
    }
    const { data: updated, error: updErr } = await admin
      .from("app_users")
      .update({
        is_active: true,
        suspended_at: null,
        suspended_reason: null,
      })
      .eq("id", input.user_id)
      .select("id, is_active, suspended_at")
      .single();
    if (updErr || !updated) {
      return jsonError(500, "update failed", origin, updErr?.message);
    }

    await writeAudit(admin, {
      actor_user_id: caller.app_user_id,
      actor_role: adminRoleFor(caller),
      action: "unsuspend_user",
      entity_table: "app_users",
      entity_id: input.user_id,
      before_data: before,
      after_data: updated,
      ip_address: clientIp(req),
      user_agent: req.headers.get("user-agent"),
    });

    return json(200, { user_id: input.user_id, is_active: true }, origin);
  } catch (err) {
    if (err instanceof AuthError) {
      return jsonError(err.status, err.message, origin);
    }
    console.error("auth-suspend error:", err);
    return jsonError(500, "internal error", origin);
  }
});
