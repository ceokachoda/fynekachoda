// Phase 8 — `streak-recompute` edge fn (admin / manual trigger).
//
// Thin authenticated wrapper over the SECURITY DEFINER `public.streak_recompute`
// DB fn (D-074 active-day streak; D-075/D-140 no freeze). The nightly cron calls
// the DB fn directly; this HTTP surface exists for admin manual re-runs. The DB
// fn is idempotent (gaps-and-islands from scratch), so re-running is safe.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { handlePreflight } from "../_shared/cors.ts";
import { json, jsonError } from "../_shared/response.ts";
import { getServiceRoleClient } from "../_shared/supabase.ts";
import { AuthError, loadCaller, requireAnyRole } from "../_shared/auth.ts";

Deno.serve(async (req: Request) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  const origin = req.headers.get("Origin");

  if (req.method !== "POST") {
    return jsonError(405, "method not allowed", origin);
  }

  try {
    const caller = await loadCaller(req);
    requireAnyRole(caller, ["staff_admin", "owner_admin"]);

    const admin = getServiceRoleClient();
    const { data, error } = await admin.rpc("streak_recompute");
    if (error) {
      return jsonError(500, "streak_recompute failed", origin, error.message);
    }
    return json(200, { ok: true, total_streaks: data }, origin);
  } catch (err) {
    if (err instanceof AuthError) {
      return jsonError(err.status, err.message, origin);
    }
    console.error("streak-recompute error:", err);
    return jsonError(500, "internal error", origin);
  }
});
