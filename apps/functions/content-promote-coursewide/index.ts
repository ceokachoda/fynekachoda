// Phase 5 CP8 — `content-promote-coursewide`.
//
// Caller: admin.
// Input:  { content_id, promote: true } | { content_id, promote: false, batch_id }
// Output: { content_item: <row> }
//
// When `promote = true`: set `batch_id = NULL` (course-wide). The item is
// also auto-published (admin acted on it, signaling approval). When
// `promote = false`: scope back to the supplied batch_id (must belong to
// the same course). Audited before/after.

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
import { ContentPromoteCoursewideInputSchema } from "../_shared/schemas.ts";
import { clientIp, writeAudit } from "../_shared/audit.ts";

Deno.serve(async (req: Request) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  const origin = req.headers.get("Origin");
  if (req.method !== "POST") return jsonError(405, "method not allowed", origin);

  try {
    const caller = await loadCaller(req);
    requireAnyRole(caller, ["owner_admin", "staff_admin"]);

    const rawBody = await req.json().catch(() => null);
    if (rawBody === null) return jsonError(400, "invalid JSON body", origin);
    const parsed = ContentPromoteCoursewideInputSchema.safeParse(rawBody);
    if (!parsed.success) {
      return jsonError(400, "validation failed", origin, parsed.error.issues);
    }
    const { content_id, promote, batch_id } = parsed.data;

    if (!promote && !batch_id) {
      return jsonError(400, "batch_id required when un-promoting", origin);
    }

    const admin = getServiceRoleClient();
    const { data: prev, error: prevErr } = await admin
      .from("content_items")
      .select("*")
      .eq("id", content_id)
      .maybeSingle();
    if (prevErr) {
      return jsonError(500, "content lookup failed", origin, prevErr.message);
    }
    if (!prev) return jsonError(404, "content not found", origin);

    if (!promote) {
      const { data: batchRow, error: batchErr } = await admin
        .from("batches")
        .select("id, course_id")
        .eq("id", batch_id!)
        .maybeSingle();
      if (batchErr || !batchRow) {
        return jsonError(404, "batch not found", origin);
      }
      if (batchRow.course_id !== prev.course_id) {
        return jsonError(409, "batch course mismatch", origin);
      }
    }

    const patch: Record<string, unknown> = {
      batch_id: promote ? null : batch_id,
    };
    if (promote && !prev.is_published) patch.is_published = true;

    const { data: updated, error: updErr } = await admin
      .from("content_items")
      .update(patch)
      .eq("id", content_id)
      .select("*")
      .single();
    if (updErr) {
      return jsonError(500, "update failed", origin, updErr.message);
    }

    await writeAudit(admin, {
      actor_user_id: caller.app_user_id,
      actor_role: adminRoleFor(caller),
      action: promote ? "content_promote" : "content_unpromote",
      entity_table: "content_items",
      entity_id: content_id,
      before_data: prev,
      after_data: updated,
      ip_address: clientIp(req),
      user_agent: req.headers.get("user-agent"),
    });

    return json(200, { content_item: updated }, origin);
  } catch (err) {
    if (err instanceof AuthError) {
      return jsonError(err.status, err.message, origin);
    }
    console.error("content-promote-coursewide error:", err);
    return jsonError(500, "internal error", origin);
  }
});
