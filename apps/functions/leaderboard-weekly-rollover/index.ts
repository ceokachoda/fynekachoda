import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { handlePreflight } from "../_shared/cors.ts";
import { json, jsonError } from "../_shared/response.ts";
import { getServiceRoleClient } from "../_shared/supabase.ts";
import {
  adminRoleFor,
  AuthError,
  loadCaller,
  requireAnyRole,
} from "../_shared/auth.ts";
import { clientIp, writeAudit } from "../_shared/audit.ts";

// Phase 10 CP5 — admin "force-run weekly rollover" surface (same DB fn the Sunday
// 18:29 UTC pg_cron job calls directly). Snapshots each batch's final weekly board +
// awards topper/runner-up. Idempotent (D-106): running again for a period that's
// already snapshotted is a no-op. Admin-only; audits the run.
//
// Body: { period_start?: 'YYYY-MM-DD', batch_id?: uuid }

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

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

    const body = (await req.json().catch(() => ({}))) as {
      period_start?: unknown;
      batch_id?: unknown;
    };
    const periodStart =
      typeof body.period_start === "string" && ISO_DATE.test(body.period_start)
        ? body.period_start
        : null;
    if (body.period_start !== undefined && body.period_start !== null && periodStart === null) {
      return jsonError(400, "period_start must be YYYY-MM-DD", origin);
    }
    const batchId = typeof body.batch_id === "string" ? body.batch_id : null;

    const admin = getServiceRoleClient();
    const { data, error } = await admin.rpc("leaderboard_weekly_rollover", {
      p_period_start: periodStart,
      p_batch: batchId,
    });
    if (error) {
      return jsonError(500, "rollover failed", origin, error.message);
    }

    await writeAudit(admin, {
      actor_user_id: caller.app_user_id,
      actor_role: adminRoleFor(caller),
      action: "leaderboard_rollover",
      entity_table: "leaderboard_snapshots",
      entity_id: batchId,
      after_data: { batches_processed: data, period_start: periodStart, batch_id: batchId },
      ip_address: clientIp(req),
      user_agent: req.headers.get("user-agent"),
    });

    return json(200, { ok: true, batches_processed: data }, origin);
  } catch (err) {
    if (err instanceof AuthError) {
      return jsonError(err.status, err.message, origin);
    }
    console.error("leaderboard-weekly-rollover error:", err);
    return jsonError(500, "internal error", origin);
  }
});
