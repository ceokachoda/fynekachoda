import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { handlePreflight } from "../_shared/cors.ts";
import { json, jsonError } from "../_shared/response.ts";
import { getServiceRoleClient } from "../_shared/supabase.ts";
import { AuthError, adminRoleFor, loadCaller, requireAnyRole } from "../_shared/auth.ts";
import { clientIp, writeAudit } from "../_shared/audit.ts";
import { BatchTransferInputSchema } from "../_shared/schemas.ts";

Deno.serve(async (req: Request) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  const origin = req.headers.get("Origin");

  if (req.method !== "POST") {
    return jsonError(405, "method not allowed", origin);
  }

  try {
    const caller = await loadCaller(req);
    requireAnyRole(caller, ["owner_admin", "staff_admin"]);

    const raw = await req.json().catch(() => null);
    if (raw === null) return jsonError(400, "invalid JSON body", origin);
    const parsed = BatchTransferInputSchema.safeParse(raw);
    if (!parsed.success) {
      return jsonError(400, "validation failed", origin, parsed.error.issues);
    }
    const { student_id, to_batch_id, reason } = parsed.data;

    const admin = getServiceRoleClient();

    const { data: student, error: studentErr } = await admin
      .from("students")
      .select("user_id, batch_id")
      .eq("user_id", student_id)
      .maybeSingle();
    if (studentErr) {
      return jsonError(500, "student lookup failed", origin, studentErr.message);
    }
    if (!student) return jsonError(404, "student not found", origin);

    const { data: targetBatch, error: batchErr } = await admin
      .from("batches")
      .select("id, name, capacity, is_active")
      .eq("id", to_batch_id)
      .maybeSingle();
    if (batchErr) {
      return jsonError(500, "batch lookup failed", origin, batchErr.message);
    }
    if (!targetBatch) return jsonError(404, "target batch not found", origin);
    if (!targetBatch.is_active) {
      return jsonError(409, "target batch is inactive", origin);
    }

    if (student.batch_id === to_batch_id) {
      return jsonError(409, "student already in this batch", origin);
    }

    // Capacity check.
    // Race window: a near-simultaneous transfer/create could push the batch to
    // capacity+1 between this count and the UPDATE below. Admin-only flow with
    // low throughput in MVP; revisit with row-level lock or stored proc in Phase 12.
    const { count: occupied, error: countErr } = await admin
      .from("students")
      .select("user_id", { count: "exact", head: true })
      .eq("batch_id", to_batch_id);
    if (countErr) {
      return jsonError(500, "capacity count failed", origin, countErr.message);
    }
    if ((occupied ?? 0) >= targetBatch.capacity) {
      return jsonError(409, "batch full", origin, {
        capacity: targetBatch.capacity,
        occupied,
      });
    }

    const beforeBatchId = student.batch_id;

    const { data: updated, error: updateErr } = await admin
      .from("students")
      .update({ batch_id: to_batch_id })
      .eq("user_id", student_id)
      .select("user_id, batch_id")
      .single();
    if (updateErr || !updated) {
      return jsonError(500, "transfer failed", origin, updateErr?.message);
    }

    await writeAudit(admin, {
      actor_user_id: caller.app_user_id,
      actor_role: adminRoleFor(caller),
      action: "transfer_student",
      entity_table: "students",
      entity_id: student_id,
      before_data: { batch_id: beforeBatchId },
      after_data: {
        batch_id: updated.batch_id,
        target_batch_name: targetBatch.name,
        reason,
      },
      ip_address: clientIp(req),
      user_agent: req.headers.get("user-agent"),
    });

    return json(
      200,
      {
        student_id: updated.user_id,
        from_batch_id: beforeBatchId,
        to_batch_id: updated.batch_id,
      },
      origin,
    );
  } catch (err) {
    if (err instanceof AuthError) {
      return jsonError(err.status, err.message, origin);
    }
    console.error("batch-transfer error:", err);
    return jsonError(500, "internal error", origin);
  }
});
