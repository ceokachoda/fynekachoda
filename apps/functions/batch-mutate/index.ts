import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { handlePreflight } from "../_shared/cors.ts";
import { json, jsonError } from "../_shared/response.ts";
import { getServiceRoleClient } from "../_shared/supabase.ts";
import { AuthError, adminRoleFor, loadCaller, requireAnyRole } from "../_shared/auth.ts";
import { clientIp, writeAudit } from "../_shared/audit.ts";
import { BatchMutateInputSchema } from "../_shared/schemas.ts";

Deno.serve(async (req: Request) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  const origin = req.headers.get("Origin");

  if (req.method !== "POST") return jsonError(405, "method not allowed", origin);

  try {
    const caller = await loadCaller(req);
    requireAnyRole(caller, ["owner_admin", "staff_admin"]);

    const raw = await req.json().catch(() => null);
    if (raw === null) return jsonError(400, "invalid JSON body", origin);
    const parsed = BatchMutateInputSchema.safeParse(raw);
    if (!parsed.success) {
      return jsonError(400, "validation failed", origin, parsed.error.issues);
    }
    const input = parsed.data;
    const admin = getServiceRoleClient();

    let before: Record<string, unknown> | null = null;
    let after: Record<string, unknown> | null = null;
    let entityId: string | null = null;
    let entityTable = "batches";

    if (input.op === "create_batch") {
      const { data, error } = await admin.from("batches").insert(input.payload).select("*").single();
      if (error || !data) {
        if ((error as { code?: string } | null)?.code === "23505") {
          return jsonError(409, "batch name already used", origin, error.message);
        }
        return jsonError(500, "create_batch failed", origin, error?.message);
      }
      after = data as Record<string, unknown>;
      entityId = String(data.id);
    } else if (input.op === "update_batch") {
      const { data: prev, error: prevErr } = await admin.from("batches").select("*").eq("id", input.id).maybeSingle();
      if (prevErr) return jsonError(500, "lookup failed", origin, prevErr.message);
      if (!prev) return jsonError(404, "batch not found", origin);
      const { data, error } = await admin.from("batches").update(input.patch).eq("id", input.id).select("*").single();
      if (error || !data) {
        if ((error as { code?: string } | null)?.code === "23505") {
          return jsonError(409, "batch name already used", origin, error.message);
        }
        return jsonError(500, "update_batch failed", origin, error?.message);
      }
      before = prev as Record<string, unknown>;
      after = data as Record<string, unknown>;
      entityId = input.id;
    } else if (input.op === "delete_batch") {
      const { data: prev, error: prevErr } = await admin.from("batches").select("*").eq("id", input.id).maybeSingle();
      if (prevErr) return jsonError(500, "lookup failed", origin, prevErr.message);
      if (!prev) return jsonError(404, "batch not found", origin);
      const { error } = await admin.from("batches").delete().eq("id", input.id);
      if (error) {
        if ((error as { code?: string } | null)?.code === "23503") {
          return jsonError(409, "batch has students or schedule referencing it", origin, error.message);
        }
        return jsonError(500, "delete_batch failed", origin, error.message);
      }
      before = prev as Record<string, unknown>;
      entityId = input.id;
    } else if (input.op === "assign_teacher") {
      entityTable = "batch_teachers";
      const { data: teacher, error: tErr } = await admin.from("teachers").select("user_id").eq("user_id", input.teacher_id).maybeSingle();
      if (tErr) return jsonError(500, "teacher lookup failed", origin, tErr.message);
      if (!teacher) return jsonError(404, "teacher not found", origin);
      const { data: batch, error: bErr } = await admin.from("batches").select("id").eq("id", input.batch_id).maybeSingle();
      if (bErr) return jsonError(500, "batch lookup failed", origin, bErr.message);
      if (!batch) return jsonError(404, "batch not found", origin);
      const { error } = await admin
        .from("batch_teachers")
        .insert({ batch_id: input.batch_id, teacher_id: input.teacher_id });
      if (error) {
        if ((error as { code?: string } | null)?.code === "23505") {
          return jsonError(409, "teacher already assigned to this batch", origin, error.message);
        }
        return jsonError(500, "assign_teacher failed", origin, error.message);
      }
      after = { batch_id: input.batch_id, teacher_id: input.teacher_id };
      entityId = `${input.batch_id}:${input.teacher_id}`;
    } else if (input.op === "unassign_teacher") {
      entityTable = "batch_teachers";
      const { error } = await admin
        .from("batch_teachers")
        .delete()
        .eq("batch_id", input.batch_id)
        .eq("teacher_id", input.teacher_id);
      if (error) return jsonError(500, "unassign_teacher failed", origin, error.message);
      before = { batch_id: input.batch_id, teacher_id: input.teacher_id };
      entityId = `${input.batch_id}:${input.teacher_id}`;
    } else if (input.op === "create_schedule_row") {
      entityTable = "batch_schedule";
      const { data, error } = await admin.from("batch_schedule").insert(input.payload).select("*").single();
      if (error || !data) return jsonError(500, "create_schedule_row failed", origin, error?.message);
      after = data as Record<string, unknown>;
      entityId = String(data.id);
    } else if (input.op === "delete_schedule_row") {
      entityTable = "batch_schedule";
      const { data: prev, error: prevErr } = await admin.from("batch_schedule").select("*").eq("id", input.id).maybeSingle();
      if (prevErr) return jsonError(500, "lookup failed", origin, prevErr.message);
      if (!prev) return jsonError(404, "schedule row not found", origin);
      const { error } = await admin.from("batch_schedule").delete().eq("id", input.id);
      if (error) return jsonError(500, "delete_schedule_row failed", origin, error.message);
      before = prev as Record<string, unknown>;
      entityId = input.id;
    }

    await writeAudit(admin, {
      actor_user_id: caller.app_user_id,
      actor_role: adminRoleFor(caller),
      action: input.op,
      entity_table: entityTable,
      entity_id: entityId,
      before_data: before,
      after_data: after,
      ip_address: clientIp(req),
      user_agent: req.headers.get("user-agent"),
    });

    return json(200, { ok: true, op: input.op, id: entityId, row: after ?? null }, origin);
  } catch (err) {
    if (err instanceof AuthError) return jsonError(err.status, err.message, origin);
    console.error("batch-mutate error:", err);
    return jsonError(500, "internal error", origin);
  }
});
