// Phase 5 CP8 — `content-toggle-publish`.
//
// Caller: admin (owner_admin or staff_admin).
// Input:  { content_id, is_published }
// Output: { content_item: <row> }
//
// Flips `is_published` on a `content_items` row. Audits before/after.

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
import { ContentTogglePublishInputSchema } from "../_shared/schemas.ts";
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
    const parsed = ContentTogglePublishInputSchema.safeParse(rawBody);
    if (!parsed.success) {
      return jsonError(400, "validation failed", origin, parsed.error.issues);
    }
    const { content_id, is_published } = parsed.data;

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

    const { data: updated, error: updErr } = await admin
      .from("content_items")
      .update({ is_published })
      .eq("id", content_id)
      .select("*")
      .single();
    if (updErr) {
      return jsonError(500, "update failed", origin, updErr.message);
    }

    await writeAudit(admin, {
      actor_user_id: caller.app_user_id,
      actor_role: adminRoleFor(caller),
      action: is_published ? "content_publish" : "content_unpublish",
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
    console.error("content-toggle-publish error:", err);
    return jsonError(500, "internal error", origin);
  }
});
