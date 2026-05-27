// Phase 9 CP7 — `chat-delete`.
//
// Caller: teacher of the message's session batch (or admin). Soft-deletes a
// chat message (is_deleted=true). The UPDATE propagates over Realtime to every
// connected client (chat_messages is in the publication and cm_read does NOT
// gate on is_deleted), so the message disappears for all viewers within ~1s.
// Audited (D-172) — that's why this is an edge fn rather than a client UPDATE.

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
import { ChatDeleteInputSchema } from "../_shared/schemas.ts";
import { clientIp, writeAudit } from "../_shared/audit.ts";

Deno.serve(async (req: Request) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  const origin = req.headers.get("Origin");

  if (req.method !== "POST") return jsonError(405, "method not allowed", origin);

  try {
    const caller = await loadCaller(req);
    requireAnyRole(caller, ["teacher", "owner_admin", "staff_admin"]);

    const rawBody = await req.json().catch(() => null);
    if (rawBody === null) return jsonError(400, "invalid JSON body", origin);
    const parsed = ChatDeleteInputSchema.safeParse(rawBody);
    if (!parsed.success) {
      return jsonError(400, "validation failed", origin, parsed.error.issues);
    }
    const { message_id } = parsed.data;

    const admin = getServiceRoleClient();
    const isAdmin = adminRoleFor(caller) !== null;

    const { data: msg, error: mErr } = await admin
      .from("chat_messages")
      .select("id, session_id, author_id, is_deleted")
      .eq("id", message_id)
      .maybeSingle();
    if (mErr) return jsonError(500, "message lookup failed", origin, mErr.message);
    if (!msg) return jsonError(404, "message not found", origin);

    const { data: session, error: sErr } = await admin
      .from("sessions")
      .select("id, batch_id")
      .eq("id", msg.session_id as string)
      .maybeSingle();
    if (sErr) return jsonError(500, "session lookup failed", origin, sErr.message);
    if (!session) return jsonError(404, "session not found", origin);

    if (!isAdmin) {
      const { data: assignment, error: aErr } = await admin
        .from("batch_teachers")
        .select("teacher_id")
        .eq("batch_id", session.batch_id as string)
        .eq("teacher_id", caller.app_user_id)
        .maybeSingle();
      if (aErr) {
        return jsonError(500, "teacher assignment lookup failed", origin, aErr.message);
      }
      if (!assignment) {
        return jsonError(403, "teacher not assigned to this batch", origin);
      }
    }

    if (msg.is_deleted) {
      return json(200, { message_id, is_deleted: true }, origin);
    }

    const { error: uErr } = await admin
      .from("chat_messages")
      .update({
        is_deleted: true,
        deleted_by: caller.app_user_id,
        deleted_at: new Date().toISOString(),
      })
      .eq("id", message_id);
    if (uErr) return jsonError(500, "message delete failed", origin, uErr.message);

    await writeAudit(admin, {
      actor_user_id: caller.app_user_id,
      actor_role: isAdmin ? adminRoleFor(caller) : "teacher",
      action: "chat_message_deleted",
      entity_table: "chat_messages",
      entity_id: message_id,
      before_data: { is_deleted: false, author_id: msg.author_id },
      after_data: { is_deleted: true },
      ip_address: clientIp(req),
      user_agent: req.headers.get("user-agent"),
    });

    return json(200, { message_id, is_deleted: true }, origin);
  } catch (err) {
    if (err instanceof AuthError) return jsonError(err.status, err.message, origin);
    console.error("chat-delete error:", err);
    return jsonError(500, "internal error", origin);
  }
});
