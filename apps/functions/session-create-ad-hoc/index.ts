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
import { notifyStudents } from "../_shared/notify.ts";

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

    // Teacher-given class name. Read straight off the raw body + validated
    // inline (not via the shared schema) so this fn rolls out independently of
    // the bundled _shared/schemas.ts version. The schema documents `title` as
    // optional; the create UI requires a non-empty value. Null → display falls
    // back to the subject name, then "Class".
    const rawTitle = (rawBody as { title?: unknown }).title;
    const trimmedTitle =
      typeof rawTitle === "string" ? rawTitle.trim() : "";
    const title =
      trimmedTitle.length >= 1 && trimmedTitle.length <= 120
        ? trimmedTitle
        : null;

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

    // A batch can hold only one session at a given start instant — enforced by
    // the `sessions_batch_start_unique (batch_id, scheduled_start)` constraint
    // (also what keeps the nightly materialize idempotent). Pre-check so the
    // teacher gets a clear, actionable message instead of an opaque
    // "session insert failed" duplicate-key error. The 23505 fallback on the
    // insert below closes the check-then-insert race.
    const CONFLICT_MSG =
      "This batch already has a class scheduled at that start time. Pick a different time.";
    const { data: clash, error: clashErr } = await admin
      .from("sessions")
      .select("id")
      .eq("batch_id", batch_id)
      .eq("scheduled_start", scheduled_start)
      .maybeSingle();
    if (clashErr) {
      return jsonError(500, "session lookup failed", origin, clashErr.message);
    }
    if (clash) return jsonError(409, CONFLICT_MSG, origin);

    const { data: inserted, error: insertErr } = await admin
      .from("sessions")
      .insert({
        batch_id,
        subject_id: subject_id ?? null,
        title: title ?? null,
        scheduled_start,
        scheduled_end,
        is_ad_hoc: true,
        is_live_class,
        created_by: caller.app_user_id,
      })
      .select("id, scheduled_start, scheduled_end")
      .single();
    if (insertErr || !inserted) {
      // Lost the race to a concurrent create for the same (batch, start).
      if ((insertErr as { code?: string } | null)?.code === "23505") {
        return jsonError(409, CONFLICT_MSG, origin);
      }
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
        title: title ?? null,
        scheduled_start,
        scheduled_end,
        is_live_class,
        is_ad_hoc: true,
      },
      ip_address: clientIp(req),
      user_agent: req.headers.get("user-agent"),
    });

    // Tell the batch's students a new class has been put on their schedule.
    notifyStudents(
      { batch_id },
      {
        title: is_live_class ? "New live class scheduled" : "New class scheduled",
        body: `${title ?? "A class"} has been added to your schedule.`,
        data: { type: "class_scheduled", session_id: inserted.id as string },
      },
    );

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
