// Phase 9 CP5 — `yt-broadcast-stop`.
//
// Caller: teacher assigned to the session's batch (or admin). Transitions the
// YouTube broadcast to `complete` (best-effort), marks the session ended, emits
// a `kind='system'` chat message so connected students receive the end signal
// over the RLS-scoped chat channel, and resolves any dangling raised hands.
//
// Idempotent + tolerant: marking the session ended always succeeds even when
// YouTube is unconfigured or the transition errors (e.g. the broadcast already
// auto-stopped) — the recording stays available via the stored yt_video_id.

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
import { YtBroadcastStopInputSchema } from "../_shared/schemas.ts";
import { clientIp, writeAudit } from "../_shared/audit.ts";
import {
  getBroadcast,
  transitionBroadcast,
  YtApiError,
  YtNotConfiguredError,
} from "../_shared/yt-api.ts";

const LIVE_STATES = new Set([
  "live",
  "liveStarting",
  "testing",
  "testStarting",
]);

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
    const parsed = YtBroadcastStopInputSchema.safeParse(rawBody);
    if (!parsed.success) {
      return jsonError(400, "validation failed", origin, parsed.error.issues);
    }
    const { session_id } = parsed.data;

    const admin = getServiceRoleClient();
    const isAdmin = adminRoleFor(caller) !== null;

    const { data: session, error: sErr } = await admin
      .from("sessions")
      .select("id, batch_id, status, yt_broadcast_id, yt_video_id, ended_at")
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

    // Stop the YouTube broadcast (best-effort — never blocks ending the class).
    let ytStopped = false;
    if (session.yt_broadcast_id) {
      try {
        const b = await getBroadcast(session.yt_broadcast_id as string);
        if (b && LIVE_STATES.has(b.lifeCycleStatus)) {
          await transitionBroadcast(session.yt_broadcast_id as string, "complete");
          ytStopped = true;
        } else if (b && b.lifeCycleStatus === "complete") {
          ytStopped = true;
        }
      } catch (err) {
        if (err instanceof YtNotConfiguredError) {
          // expected pre-OAuth; fall through and still mark the session ended.
        } else if (err instanceof YtApiError) {
          console.error("yt-broadcast-stop transition failed:", err.status, err.body);
        } else {
          throw err;
        }
      }
    }

    const alreadyEnded = session.status === "ended";
    const endedAt = (session.ended_at as string | null) ?? new Date().toISOString();
    const { error: uErr } = await admin
      .from("sessions")
      .update({ status: "ended", ended_at: endedAt })
      .eq("id", session_id);
    if (uErr) return jsonError(500, "session update failed", origin, uErr.message);

    // Resolve any hands still up (best-effort). Idempotent — only touches unresolved.
    await admin
      .from("raise_hand_events")
      .update({ resolved_at: new Date().toISOString(), resolved_by: caller.app_user_id })
      .eq("session_id", session_id)
      .is("resolved_at", null);

    // System message → students' chat channel receives the end-of-class signal
    // (service role bypasses the cm_insert live-only check). Skip on a re-stop so
    // a double-tap / retry doesn't post a duplicate "Class has ended." marker.
    if (!alreadyEnded) {
      const { error: msgErr } = await admin.from("chat_messages").insert({
        session_id,
        author_id: caller.app_user_id,
        kind: "system",
        body: "Class has ended.",
      });
      if (msgErr) console.error("system end message insert failed:", msgErr.message);
    }

    if (session.yt_broadcast_id) {
      await writeAudit(admin, {
        actor_user_id: caller.app_user_id,
        actor_role: isAdmin ? adminRoleFor(caller) : "teacher",
        action: "yt_broadcast_stopped",
        entity_table: "sessions",
        entity_id: session_id,
        after_data: { yt_broadcast_id: session.yt_broadcast_id, yt_stopped: ytStopped },
        ip_address: clientIp(req),
        user_agent: req.headers.get("user-agent"),
      });
    }
    await writeAudit(admin, {
      actor_user_id: caller.app_user_id,
      actor_role: isAdmin ? adminRoleFor(caller) : "teacher",
      action: "live_session_ended",
      entity_table: "sessions",
      entity_id: session_id,
      before_data: { status: session.status },
      after_data: { status: "ended", ended_at: endedAt, yt_stopped: ytStopped },
      ip_address: clientIp(req),
      user_agent: req.headers.get("user-agent"),
    });

    return json(
      200,
      {
        session_id,
        status: "ended",
        yt_video_id: session.yt_video_id,
        recording_available: !!session.yt_video_id,
        yt_stopped: ytStopped,
      },
      origin,
    );
  } catch (err) {
    if (err instanceof AuthError) return jsonError(err.status, err.message, origin);
    console.error("yt-broadcast-stop error:", err);
    return jsonError(500, "internal error", origin);
  }
});
