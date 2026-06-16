// `push-unregister` — stop sending to a device for the caller (on logout).
//
// Caller: any authenticated user. Marks the matching row inactive, scoped to
// the caller's own user_id so one user can never deactivate another's device.
// Best-effort: the client calls this right BEFORE supabase.auth.signOut() while
// the JWT is still valid; failures are ignored on the client.
//   { kind: "expo", token }
//   { kind: "web",  endpoint }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { handlePreflight } from "../_shared/cors.ts";
import { json, jsonError } from "../_shared/response.ts";
import { getServiceRoleClient } from "../_shared/supabase.ts";
import { AuthError, loadCaller } from "../_shared/auth.ts";

Deno.serve(async (req: Request) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  const origin = req.headers.get("Origin");
  if (req.method !== "POST") return jsonError(405, "method not allowed", origin);

  try {
    const caller = await loadCaller(req);
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return jsonError(400, "invalid JSON body", origin);

    const admin = getServiceRoleClient();
    const now = new Date().toISOString();

    if (body.kind === "expo") {
      const token = body.token;
      if (typeof token !== "string") return jsonError(400, "token required", origin);
      const { error } = await admin
        .from("device_push_tokens")
        .update({ is_active: false, updated_at: now })
        .eq("expo_push_token", token)
        .eq("user_id", caller.app_user_id);
      if (error) return jsonError(500, "unregister failed", origin, error.message);
      return json(200, { ok: true }, origin);
    }

    if (body.kind === "web") {
      const endpoint = body.endpoint;
      if (typeof endpoint !== "string") return jsonError(400, "endpoint required", origin);
      const { error } = await admin
        .from("web_push_subscriptions")
        .update({ is_active: false, updated_at: now })
        .eq("endpoint", endpoint)
        .eq("user_id", caller.app_user_id);
      if (error) return jsonError(500, "unregister failed", origin, error.message);
      return json(200, { ok: true }, origin);
    }

    return jsonError(400, "kind must be 'expo' or 'web'", origin);
  } catch (err) {
    if (err instanceof AuthError) return jsonError(err.status, err.message, origin);
    console.error("push-unregister error:", err);
    return jsonError(500, "internal error", origin);
  }
});
