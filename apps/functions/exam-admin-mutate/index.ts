// Phase 7 CP9b — `exam-admin-mutate` edge fn (D-177 single discriminated
// union per resource family).
//
// Admin moderation surface for /exams + /offline-scores in the admin
// dashboard. Mirrors `quiz-admin-mutate`. All ops audit before/after via
// `audit_log` per D-172.
//
// Ops:
//   - toggle_publish_exam       { exam_id, is_published }
//   - force_release_results     { exam_id }
//   - force_unrelease_results   { exam_id }   — admin-only un-release
//   - delete_exam               { exam_id }   — cascades to attempts/answers
//   - delete_offline_score      { offline_score_id }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { handlePreflight } from "../_shared/cors.ts";
import { json, jsonError } from "../_shared/response.ts";
import { getServiceRoleClient } from "../_shared/supabase.ts";
import { adminRoleFor, AuthError, loadCaller } from "../_shared/auth.ts";
import { ExamAdminMutateInputSchema } from "../_shared/schemas.ts";
import { clientIp, writeAudit } from "../_shared/audit.ts";

function isAdmin(roles: string[]): boolean {
  return roles.includes("owner_admin") || roles.includes("staff_admin");
}

Deno.serve(async (req: Request) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  const origin = req.headers.get("Origin");

  if (req.method !== "POST") {
    return jsonError(405, "method not allowed", origin);
  }

  try {
    const caller = await loadCaller(req);
    if (!isAdmin(caller.roles)) {
      return jsonError(403, "admin only", origin);
    }

    const rawBody = await req.json().catch(() => null);
    if (rawBody === null) return jsonError(400, "invalid JSON body", origin);
    const parsed = ExamAdminMutateInputSchema.safeParse(rawBody);
    if (!parsed.success) {
      return jsonError(400, "validation failed", origin, parsed.error.issues);
    }

    const admin = getServiceRoleClient();
    const actorRole = adminRoleFor(caller);
    const ip = clientIp(req);
    const ua = req.headers.get("user-agent");

    switch (parsed.data.op) {
      case "toggle_publish_exam": {
        const { exam_id, is_published } = parsed.data;
        const { data: before, error: bErr } = await admin
          .from("exams")
          .select("*")
          .eq("id", exam_id)
          .maybeSingle();
        if (bErr) {
          return jsonError(500, "exam lookup failed", origin, bErr.message);
        }
        if (!before) return jsonError(404, "exam not found", origin);
        const { data: after, error: uErr } = await admin
          .from("exams")
          .update({ is_published })
          .eq("id", exam_id)
          .select("*")
          .single();
        if (uErr) {
          return jsonError(500, "update failed", origin, uErr.message);
        }
        await writeAudit(admin, {
          actor_user_id: caller.app_user_id,
          actor_role: actorRole,
          action: is_published ? "exam_publish" : "exam_unpublish",
          entity_table: "exams",
          entity_id: exam_id,
          before_data: before,
          after_data: after,
          ip_address: ip,
          user_agent: ua,
        });
        return json(200, { exam: after }, origin);
      }

      case "force_release_results": {
        const { exam_id } = parsed.data;
        const { data: before, error: bErr } = await admin
          .from("exams")
          .select("*")
          .eq("id", exam_id)
          .maybeSingle();
        if (bErr) {
          return jsonError(500, "exam lookup failed", origin, bErr.message);
        }
        if (!before) return jsonError(404, "exam not found", origin);
        const releasedAt = before.results_released_at ?? new Date().toISOString();
        const { data: after, error: uErr } = await admin
          .from("exams")
          .update({ results_released_at: releasedAt })
          .eq("id", exam_id)
          .select("*")
          .single();
        if (uErr) {
          return jsonError(500, "force release failed", origin, uErr.message);
        }
        await writeAudit(admin, {
          actor_user_id: caller.app_user_id,
          actor_role: actorRole,
          action: "exam_results_force_released",
          entity_table: "exams",
          entity_id: exam_id,
          before_data: { results_released_at: before.results_released_at },
          after_data: { results_released_at: after.results_released_at },
          ip_address: ip,
          user_agent: ua,
        });
        return json(200, { exam: after }, origin);
      }

      case "force_unrelease_results": {
        const { exam_id } = parsed.data;
        const { data: before, error: bErr } = await admin
          .from("exams")
          .select("*")
          .eq("id", exam_id)
          .maybeSingle();
        if (bErr) {
          return jsonError(500, "exam lookup failed", origin, bErr.message);
        }
        if (!before) return jsonError(404, "exam not found", origin);
        const { data: after, error: uErr } = await admin
          .from("exams")
          .update({ results_released_at: null })
          .eq("id", exam_id)
          .select("*")
          .single();
        if (uErr) {
          return jsonError(500, "unrelease failed", origin, uErr.message);
        }
        await writeAudit(admin, {
          actor_user_id: caller.app_user_id,
          actor_role: actorRole,
          action: "exam_results_unreleased",
          entity_table: "exams",
          entity_id: exam_id,
          before_data: { results_released_at: before.results_released_at },
          after_data: { results_released_at: null },
          ip_address: ip,
          user_agent: ua,
        });
        return json(200, { exam: after }, origin);
      }

      case "delete_exam": {
        const { exam_id } = parsed.data;
        const { data: before, error: bErr } = await admin
          .from("exams")
          .select("*")
          .eq("id", exam_id)
          .maybeSingle();
        if (bErr) {
          return jsonError(500, "exam lookup failed", origin, bErr.message);
        }
        if (!before) return jsonError(404, "exam not found", origin);
        const { count: attemptCount } = await admin
          .from("exam_attempts")
          .select("id", { count: "exact", head: true })
          .eq("exam_id", exam_id);
        const { error: dErr } = await admin
          .from("exams")
          .delete()
          .eq("id", exam_id);
        if (dErr) {
          return jsonError(500, "delete failed", origin, dErr.message);
        }
        await writeAudit(admin, {
          actor_user_id: caller.app_user_id,
          actor_role: actorRole,
          action: "exam_delete",
          entity_table: "exams",
          entity_id: exam_id,
          before_data: { ...before, cascaded_attempts: attemptCount ?? 0 },
          ip_address: ip,
          user_agent: ua,
        });
        return json(200, { deleted: true, cascaded_attempts: attemptCount ?? 0 }, origin);
      }

      case "delete_offline_score": {
        const { offline_score_id } = parsed.data;
        const { data: before, error: bErr } = await admin
          .from("offline_test_scores")
          .select("*")
          .eq("id", offline_score_id)
          .maybeSingle();
        if (bErr) {
          return jsonError(500, "score lookup failed", origin, bErr.message);
        }
        if (!before) return jsonError(404, "score not found", origin);
        const { error: dErr } = await admin
          .from("offline_test_scores")
          .delete()
          .eq("id", offline_score_id);
        if (dErr) {
          return jsonError(500, "delete failed", origin, dErr.message);
        }
        await writeAudit(admin, {
          actor_user_id: caller.app_user_id,
          actor_role: actorRole,
          action: "offline_score_delete",
          entity_table: "offline_test_scores",
          entity_id: offline_score_id,
          before_data: before,
          ip_address: ip,
          user_agent: ua,
        });
        return json(200, { deleted: true }, origin);
      }
    }
  } catch (err) {
    if (err instanceof AuthError) {
      return jsonError(err.status, err.message, origin);
    }
    console.error("exam-admin-mutate error:", err);
    return jsonError(500, "internal error", origin);
  }
});
