// Phase 9 CP8 — `yt-broadcast-golive`.
//
// The lifecycle is create -> golive -> stop. The teacher taps "Go Live" once
// they've started streaming in OBS: this flips sessions.status to 'live' (so
// students can join + yt-playback-sign issues a live token) and best-effort
// transitions the YouTube broadcast to live (with enableAutoStart it usually
// has already self-started, so the transition is tolerant of errors). Works
// even when YouTube is unconfigured — it still marks the session live, which is
// what the student-facing gate depends on.

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
import { YtBroadcastGoliveInputSchema } from "../_shared/schemas.ts";
import { clientIp, writeAudit } from "../_shared/audit.ts";
import {
  getBroadcast,
  transitionBroadcast,
  YtApiError,
  YtNotConfiguredError,
} from "../_shared/yt-api.ts";

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
    const parsed = YtBroadcastGoliveInputSchema.safeParse(rawBody);
    if (!parsed.success) {
      return jsonError(400, "validation failed", origin, parsed.error.issues);
    }
    const { session_id } = parsed.data;

    const admin = getServiceRoleClient();
    const isAdmin = adminRoleFor(caller) !== null;

    const { data: session, error: sErr } = await admin
      .from("sessions")
      .select("id, batch_id, status, is_live_class, yt_broadcast_id, started_at")
      .eq("id", session_id)
      .maybeSingle();
    if (sErr) return jsonError(500, "session lookup failed", origin, sErr.message);
    if (!session) return jsonError(404, "session not found", origin);
    if (!session.is_live_class) {
      return jsonError(400, "session is not a live class", origin);
    }
    if (session.status === "ended" || session.status === "cancelled") {
      return jsonError(409, "class is already ended or cancelled", origin);
    }

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

    // Best-effort: nudge the YT broadcast live (usually self-started already).
    let ytLive = false;
    if (session.yt_broadcast_id) {
      try {
        const b = await getBroadcast(session.yt_broadcast_id as string);
        if (b && (b.lifeCycleStatus === "live" || b.lifeCycleStatus === "liveStarting")) {
          ytLive = true;
        } else if (b && (b.lifeCycleStatus === "testing" || b.lifeCycleStatus === "ready")) {
          try {
            await transitionBroadcast(session.yt_broadcast_id as string, "live");
            ytLive = true;
          } catch (e) {
            console.error("yt-broadcast-golive transition failed (stream may not be active yet):", e instanceof Error ? e.message : e);
          }
        }
      } catch (err) {
        if (err instanceof YtNotConfiguredError) {
          // expected pre-OAuth; still mark our session live.
        } else if (err instanceof YtApiError) {
          console.error("yt-broadcast-golive YT lookup failed:", err.status, err.body);
        } else {
          throw err;
        }
      }
    }

    const startedAt = (session.started_at as string | null) ?? new Date().toISOString();
    const { error: uErr } = await admin
      .from("sessions")
      .update({ status: "live", started_at: startedAt })
      .eq("id", session_id);
    if (uErr) return jsonError(500, "session update failed", origin, uErr.message);

    await writeAudit(admin, {
      actor_user_id: caller.app_user_id,
      actor_role: isAdmin ? adminRoleFor(caller) : "teacher",
      action: "live_session_started",
      entity_table: "sessions",
      entity_id: session_id,
      before_data: { status: session.status },
      after_data: { status: "live", started_at: startedAt, yt_live: ytLive },
      ip_address: clientIp(req),
      user_agent: req.headers.get("user-agent"),
    });

    return json(
      200,
      { session_id, status: "live", started_at: startedAt, yt_live: ytLive },
      origin,
    );
  } catch (err) {
    if (err instanceof AuthError) return jsonError(err.status, err.message, origin);
    console.error("yt-broadcast-golive error:", err);
    return jsonError(500, "internal error", origin);
  }
});
