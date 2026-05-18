// Phase 4 CP6 — `session-create-ad-hoc` edge fn (spec §7, D-037).
//
// Caller: teacher assigned to the batch. Inserts a `sessions` row with
// `is_ad_hoc=true` and `created_by=teacher`. Once created, the row is
// indistinguishable from a materialized session as far as QR sign/verify
// are concerned.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { handlePreflight } from "../_shared/cors.ts";
import { json, jsonError } from "../_shared/response.ts";
import { getServiceRoleClient } from "../_shared/supabase.ts";
import { AuthError, loadCaller, requireAnyRole } from "../_shared/auth.ts";
import { SessionCreateAdHocInputSchema } from "../_shared/schemas.ts";
import { clientIp, writeAudit } from "../_shared/audit.ts";

Deno.serve(async (req: Request) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  const origin = req.headers.get("Origin");

  if (req.method !== "POST") {
    return jsonError(405, "method not allowed", origin);
  }

  try {
    const caller = await loadCaller(req);
    requireAnyRole(caller, ["teacher"]);

    const rawBody = await req.json().catch(() => null);
    if (rawBody === null) return jsonError(400, "invalid JSON body", origin);
    const parsed = SessionCreateAdHocInputSchema.safeParse(rawBody);
    if (!parsed.success) {
      return jsonError(400, "validation failed", origin, parsed.error.issues);
    }
    const {
      batch_id,
      subject_id,
      scheduled_start,
      scheduled_end,
      is_live_class,
    } = parsed.data;

    const admin = getServiceRoleClient();

    const { data: batch, error: batchErr } = await admin
      .from("batches")
      .select("id")
      .eq("id", batch_id)
      .maybeSingle();
    if (batchErr) {
      return jsonError(500, "batch lookup failed", origin, batchErr.message);
    }
    if (!batch) return jsonError(404, "batch not found", origin);

    const { data: assignment, error: assignmentErr } = await admin
      .from("batch_teachers")
      .select("teacher_id")
      .eq("batch_id", batch_id)
      .eq("teacher_id", caller.app_user_id)
      .maybeSingle();
    if (assignmentErr) {
      return jsonError(
        500,
        "teacher assignment lookup failed",
        origin,
        assignmentErr.message,
      );
    }
    if (!assignment) {
      return jsonError(403, "teacher not assigned to this batch", origin);
    }

    if (subject_id) {
      const { data: subject, error: subjErr } = await admin
        .from("subjects")
        .select("id")
        .eq("id", subject_id)
        .maybeSingle();
      if (subjErr) {
        return jsonError(500, "subject lookup failed", origin, subjErr.message);
      }
      if (!subject) return jsonError(400, "subject not found", origin);
    }

    const { data: inserted, error: insertErr } = await admin
      .from("sessions")
      .insert({
        batch_id,
        subject_id: subject_id ?? null,
        scheduled_start,
        scheduled_end,
        is_ad_hoc: true,
        is_live_class,
        created_by: caller.app_user_id,
      })
      .select("id, scheduled_start, scheduled_end")
      .single();
    if (insertErr || !inserted) {
      return jsonError(
        500,
        "session insert failed",
        origin,
        insertErr?.message,
      );
    }

    await writeAudit(admin, {
      actor_user_id: caller.app_user_id,
      actor_role: "teacher",
      action: "session_created_ad_hoc",
      entity_table: "sessions",
      entity_id: inserted.id as string,
      before_data: null,
      after_data: {
        batch_id,
        subject_id: subject_id ?? null,
        scheduled_start,
        scheduled_end,
        is_live_class,
        is_ad_hoc: true,
      },
      ip_address: clientIp(req),
      user_agent: req.headers.get("user-agent"),
    });

    return json(
      200,
      {
        session_id: inserted.id,
        scheduled_start: inserted.scheduled_start,
        scheduled_end: inserted.scheduled_end,
        is_ad_hoc: true,
      },
      origin,
    );
  } catch (err) {
    if (err instanceof AuthError) {
      return jsonError(err.status, err.message, origin);
    }
    console.error("session-create-ad-hoc error:", err);
    return jsonError(500, "internal error", origin);
  }
});
