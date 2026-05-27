// Phase 8 — `mastery-recompute` edge fn (admin / manual trigger).
//
// Thin authenticated wrapper over the SECURITY DEFINER `public.mastery_recompute`
// DB fn (D-070 rolling-N engine). The per-submit feeders call the DB fn inline;
// the nightly cron calls it directly. This HTTP surface exists for admin manual
// re-runs (targeted student/topics or a full sweep).
//
// Input: { student_id?, topic_ids?: string[], full?: boolean }
//   - { full: true }            -> sweep every (student,topic) touched in last 30d
//   - { student_id }            -> all topics that student has attempted
//   - { student_id, topic_ids } -> just those topics

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

    const body = (await req.json().catch(() => ({}))) as {
      student_id?: unknown;
      topic_ids?: unknown;
      full?: unknown;
    };
    const p_full = body.full === true;
    const p_student = typeof body.student_id === "string" ? body.student_id : null;
    const p_topic_ids = Array.isArray(body.topic_ids)
      ? body.topic_ids.filter((t): t is string => typeof t === "string")
      : null;

    if (!p_full && !p_student) {
      return jsonError(400, "provide student_id or full=true", origin);
    }

    const admin = getServiceRoleClient();
    const { data, error } = await admin.rpc("mastery_recompute", {
      p_student,
      p_topic_ids,
      p_full,
    });
    if (error) {
      return jsonError(500, "mastery_recompute failed", origin, error.message);
    }
    return json(200, { ok: true, rows_upserted: data }, origin);
  } catch (err) {
    if (err instanceof AuthError) {
      return jsonError(err.status, err.message, origin);
    }
    console.error("mastery-recompute error:", err);
    return jsonError(500, "internal error", origin);
  }
});
