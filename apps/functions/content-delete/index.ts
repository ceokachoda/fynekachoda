// Phase 5 follow-up — `content-delete`.
//
// WHY: CLAUDE.md hard rule "Every admin write produces an audit_log row".
// The admin moderation page's Delete must therefore go through an edge fn,
// not a direct PostgREST delete from a server action. Snapshots the row
// before deletion so audit captures the before_data.

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
import { ContentDeleteInputSchema } from "../_shared/schemas.ts";
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
    const parsed = ContentDeleteInputSchema.safeParse(rawBody);
    if (!parsed.success) {
      return jsonError(400, "validation failed", origin, parsed.error.issues);
    }
    const { content_id } = parsed.data;

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

    const { error: delErr } = await admin
      .from("content_items")
      .delete()
      .eq("id", content_id);
    if (delErr) {
      return jsonError(500, "delete failed", origin, delErr.message);
    }

    await writeAudit(admin, {
      actor_user_id: caller.app_user_id,
      actor_role: adminRoleFor(caller),
      action: "content_delete",
      entity_table: "content_items",
      entity_id: content_id,
      before_data: prev,
      after_data: null,
      ip_address: clientIp(req),
      user_agent: req.headers.get("user-agent"),
    });

    // Note: Storage object remains (orphan). Cleanup can be a Phase 9 cron.
    return json(
      200,
      { deleted: true, file_path: (prev as { file_path?: string }).file_path ?? null },
      origin,
    );
  } catch (err) {
    if (err instanceof AuthError) {
      return jsonError(err.status, err.message, origin);
    }
    console.error("content-delete error:", err);
    return jsonError(500, "internal error", origin);
  }
});
