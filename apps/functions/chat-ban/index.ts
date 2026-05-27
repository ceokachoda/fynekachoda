// Phase 9 CP7 — `chat-ban`.
//
// Caller: teacher of the session's batch (or admin). Bans (or unbans) a user
// from posting in a session's chat. The ban row lands in chat_bans, which is in
// the Realtime publication + readable by the banned user (cb_read own row), so
// their client disables the composer the instant the row arrives. Posting is
// hard-blocked by the cm_insert RLS policy regardless. Audited (D-172).
//
// Guards: can't ban yourself; can't ban a teacher of the batch or an admin.

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
import { ChatBanInputSchema } from "../_shared/schemas.ts";
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
    const parsed = ChatBanInputSchema.safeParse(rawBody);
    if (!parsed.success) {
      return jsonError(400, "validation failed", origin, parsed.error.issues);
    }
    const { session_id, user_id, action } = parsed.data;

    if (user_id === caller.app_user_id) {
      return jsonError(400, "cannot ban yourself", origin);
    }

    const admin = getServiceRoleClient();
    const isAdmin = adminRoleFor(caller) !== null;

    const { data: session, error: sErr } = await admin
      .from("sessions")
      .select("id, batch_id")
      .eq("id", session_id)
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

    if (action === "ban") {
      // Never ban staff / a teacher of this batch.
      const { data: targetRoles } = await admin
        .from("user_roles")
        .select("role")
        .eq("user_id", user_id);
      const roles = (targetRoles ?? []).map((r: { role: string }) => r.role);
      if (roles.includes("owner_admin") || roles.includes("staff_admin")) {
        return jsonError(403, "cannot ban an admin", origin);
      }
      const { data: targetTeach } = await admin
        .from("batch_teachers")
        .select("teacher_id")
        .eq("batch_id", session.batch_id as string)
        .eq("teacher_id", user_id)
        .maybeSingle();
      if (targetTeach) {
        return jsonError(403, "cannot ban a teacher of this batch", origin);
      }

      const { error: insErr } = await admin
        .from("chat_bans")
        .upsert(
          { session_id, user_id, banned_by: caller.app_user_id },
          { onConflict: "session_id,user_id", ignoreDuplicates: true },
        );
      if (insErr) return jsonError(500, "ban failed", origin, insErr.message);

      await writeAudit(admin, {
        actor_user_id: caller.app_user_id,
        actor_role: isAdmin ? adminRoleFor(caller) : "teacher",
        action: "chat_user_banned",
        entity_table: "chat_bans",
        entity_id: `${session_id}:${user_id}`,
        after_data: { session_id, user_id },
        ip_address: clientIp(req),
        user_agent: req.headers.get("user-agent"),
      });
      return json(200, { session_id, user_id, action: "ban" }, origin);
    }

    // action === "unban"
    const { error: delErr } = await admin
      .from("chat_bans")
      .delete()
      .eq("session_id", session_id)
      .eq("user_id", user_id);
    if (delErr) return jsonError(500, "unban failed", origin, delErr.message);

    await writeAudit(admin, {
      actor_user_id: caller.app_user_id,
      actor_role: isAdmin ? adminRoleFor(caller) : "teacher",
      action: "chat_user_unbanned",
      entity_table: "chat_bans",
      entity_id: `${session_id}:${user_id}`,
      before_data: { session_id, user_id },
      ip_address: clientIp(req),
      user_agent: req.headers.get("user-agent"),
    });
    return json(200, { session_id, user_id, action: "unban" }, origin);
  } catch (err) {
    if (err instanceof AuthError) return jsonError(err.status, err.message, origin);
    console.error("chat-ban error:", err);
    return jsonError(500, "internal error", origin);
  }
});
