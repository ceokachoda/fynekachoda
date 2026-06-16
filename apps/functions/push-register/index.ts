// `push-register` — store / refresh the caller's push destination.
//
// Caller: any authenticated user (student or teacher). Two kinds:
//   { kind: "expo", token, platform?, device_name? }
//   { kind: "web",  subscription: { endpoint, keys: { p256dh, auth } } }
//
// Upsert is keyed by the device token / endpoint (UNIQUE), so logging in on a
// shared device REASSIGNS that destination to the new user (user_id is
// overwritten) and re-activates it. Writes use the service-role client — the
// token tables are SELECT-own under RLS, no direct client writes.

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
    const kind = body.kind;

    if (kind === "expo") {
      const token = body.token;
      if (typeof token !== "string" || !token.startsWith("Expo")) {
        return jsonError(400, "invalid expo push token", origin);
      }
      const platform = typeof body.platform === "string" ? body.platform : null;
      const deviceName = typeof body.device_name === "string" ? body.device_name : null;
      const { error } = await admin
        .from("device_push_tokens")
        .upsert(
          {
            user_id: caller.app_user_id,
            expo_push_token: token,
            platform,
            device_name: deviceName,
            is_active: true,
            updated_at: now,
            last_seen_at: now,
          },
          { onConflict: "expo_push_token" },
        );
      if (error) return jsonError(500, "register failed", origin, error.message);
      return json(200, { ok: true }, origin);
    }

    if (kind === "web") {
      const sub = body.subscription as
        | { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } }
        | undefined;
      const endpoint = sub?.endpoint;
      const p256dh = sub?.keys?.p256dh;
      const auth = sub?.keys?.auth;
      if (
        typeof endpoint !== "string" ||
        typeof p256dh !== "string" ||
        typeof auth !== "string"
      ) {
        return jsonError(400, "invalid web push subscription", origin);
      }
      const { error } = await admin
        .from("web_push_subscriptions")
        .upsert(
          {
            user_id: caller.app_user_id,
            endpoint,
            p256dh,
            auth,
            user_agent: req.headers.get("user-agent"),
            is_active: true,
            updated_at: now,
            last_seen_at: now,
          },
          { onConflict: "endpoint" },
        );
      if (error) return jsonError(500, "register failed", origin, error.message);
      return json(200, { ok: true }, origin);
    }

    return jsonError(400, "kind must be 'expo' or 'web'", origin);
  } catch (err) {
    if (err instanceof AuthError) return jsonError(err.status, err.message, origin);
    console.error("push-register error:", err);
    return jsonError(500, "internal error", origin);
  }
});
