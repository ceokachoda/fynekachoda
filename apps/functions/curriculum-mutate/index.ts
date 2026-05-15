import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { handlePreflight } from "../_shared/cors.ts";
import { json, jsonError } from "../_shared/response.ts";
import { getServiceRoleClient } from "../_shared/supabase.ts";
import { AuthError, adminRoleFor, loadCaller, requireAnyRole } from "../_shared/auth.ts";
import { clientIp, writeAudit } from "../_shared/audit.ts";
import { CurriculumMutateInputSchema } from "../_shared/schemas.ts";

const ENTITY_FOR_OP: Record<string, "courses" | "subjects" | "chapters" | "topics"> = {
  create_course: "courses",
  update_course: "courses",
  delete_course: "courses",
  create_subject: "subjects",
  update_subject: "subjects",
  delete_subject: "subjects",
  create_chapter: "chapters",
  update_chapter: "chapters",
  delete_chapter: "chapters",
  create_topic: "topics",
  update_topic: "topics",
  delete_topic: "topics",
};

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
    const parsed = CurriculumMutateInputSchema.safeParse(raw);
    if (!parsed.success) {
      return jsonError(400, "validation failed", origin, parsed.error.issues);
    }
    const input = parsed.data;
    const entity = ENTITY_FOR_OP[input.op];

    const admin = getServiceRoleClient();

    let before: Record<string, unknown> | null = null;
    let after: Record<string, unknown> | null = null;
    let entityId: string | null = null;

    if (input.op.startsWith("create_")) {
      const payload = (input as { payload: Record<string, unknown> }).payload;
      const { data, error } = await admin
        .from(entity)
        .insert(payload)
        .select("*")
        .single();
      if (error || !data) {
        // Postgres unique-violation -> 409.
        if ((error as { code?: string } | null)?.code === "23505") {
          return jsonError(409, "duplicate", origin, error.message);
        }
        return jsonError(500, "insert failed", origin, error?.message);
      }
      after = data as Record<string, unknown>;
      entityId = String(data.id);
    } else if (input.op.startsWith("update_")) {
      const { id, patch } = input as {
        id: string;
        patch: Record<string, unknown>;
      };
      const { data: prev, error: prevErr } = await admin
        .from(entity)
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (prevErr) {
        return jsonError(500, "lookup failed", origin, prevErr.message);
      }
      if (!prev) return jsonError(404, `${entity} row not found`, origin);
      const { data, error } = await admin
        .from(entity)
        .update(patch)
        .eq("id", id)
        .select("*")
        .single();
      if (error || !data) {
        return jsonError(500, "update failed", origin, error?.message);
      }
      before = prev as Record<string, unknown>;
      after = data as Record<string, unknown>;
      entityId = id;
    } else if (input.op.startsWith("delete_")) {
      const { id } = input as { id: string };
      const { data: prev, error: prevErr } = await admin
        .from(entity)
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (prevErr) {
        return jsonError(500, "lookup failed", origin, prevErr.message);
      }
      if (!prev) return jsonError(404, `${entity} row not found`, origin);
      const { error } = await admin.from(entity).delete().eq("id", id);
      if (error) {
        return jsonError(500, "delete failed", origin, error.message);
      }
      before = prev as Record<string, unknown>;
      entityId = id;
    }

    await writeAudit(admin, {
      actor_user_id: caller.app_user_id,
      actor_role: adminRoleFor(caller),
      action: input.op,
      entity_table: entity,
      entity_id: entityId,
      before_data: before,
      after_data: after,
      ip_address: clientIp(req),
      user_agent: req.headers.get("user-agent"),
    });

    return json(200, { ok: true, op: input.op, entity, id: entityId, row: after ?? null }, origin);
  } catch (err) {
    if (err instanceof AuthError) {
      return jsonError(err.status, err.message, origin);
    }
    console.error("curriculum-mutate error:", err);
    return jsonError(500, "internal error", origin);
  }
});
