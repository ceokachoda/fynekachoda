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

// Phase 10 CP4 — admin/manual badge re-evaluation surface.
//
// Thin wrapper over the SECURITY DEFINER `evaluate_student_badges` DB fn (the same fn
// the feeders call inline). Admin-only — student-initiated awards flow through the
// inline feeders (D-188), never this fn. Audits each NEWLY awarded badge.
//
// Body: { student_id: uuid, triggers?: string[] }

const TRIGGERS = new Set([
  "quiz_submit",
  "exam_submit",
  "attendance",
  "video_watch",
  "streak_tick",
]);

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

    const body = (await req.json().catch(() => null)) as
      | { student_id?: unknown; triggers?: unknown }
      | null;
    if (body === null) return jsonError(400, "invalid JSON body", origin);

    const studentId =
      typeof body.student_id === "string" ? body.student_id : null;
    if (!studentId) return jsonError(400, "student_id required", origin);

    const triggers = Array.isArray(body.triggers)
      ? body.triggers.filter(
          (t): t is string => typeof t === "string" && TRIGGERS.has(t),
        )
      : null;

    const admin = getServiceRoleClient();
    const { data, error } = await admin.rpc("evaluate_student_badges", {
      p_student: studentId,
      p_triggers: triggers,
    });
    if (error) {
      return jsonError(500, "badge evaluation failed", origin, error.message);
    }

    const awarded = (data ?? []) as string[];
    for (const code of awarded) {
      await writeAudit(admin, {
        actor_user_id: caller.app_user_id,
        actor_role: adminRoleFor(caller),
        action: "badge_earned",
        entity_table: "badge_earnings",
        entity_id: studentId,
        after_data: { student_id: studentId, badge_code: code, source: "admin_evaluate" },
        ip_address: clientIp(req),
        user_agent: req.headers.get("user-agent"),
      });
    }

    return json(200, { ok: true, awarded }, origin);
  } catch (err) {
    if (err instanceof AuthError) {
      return jsonError(err.status, err.message, origin);
    }
    console.error("badge-evaluate error:", err);
    return jsonError(500, "internal error", origin);
  }
});
