// Phase 9 CP4 — `yt-broadcast-create`.
//
// Caller: teacher assigned to the session's batch (or admin). Creates an
// Unlisted YouTube Live broadcast + RTMP stream, binds them, and persists ONLY
// the broadcast/video id on the session (NEVER the stream key — that is
// returned to the creating teacher in the response and never stored).
//
// Idempotent: if the session already has a yt_broadcast_id we re-fetch the
// ingestion details from YouTube (via the bound stream) instead of creating a
// second broadcast — so the teacher can re-open the live-control screen and
// copy the key again.
//
// Degrades to 503 "YouTube not configured" when the YT_* Vault secrets are
// absent (Phase 9 ships before the institute's OAuth dance is complete).

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
import { YtBroadcastCreateInputSchema } from "../_shared/schemas.ts";
import { clientIp, writeAudit } from "../_shared/audit.ts";
import {
  bindBroadcast,
  createBroadcast,
  createStream,
  getBroadcast,
  getStreamIngestion,
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
    const parsed = YtBroadcastCreateInputSchema.safeParse(rawBody);
    if (!parsed.success) {
      return jsonError(400, "validation failed", origin, parsed.error.issues);
    }
    const { session_id } = parsed.data;

    const admin = getServiceRoleClient();
    const isAdmin = adminRoleFor(caller) !== null;

    const { data: session, error: sErr } = await admin
      .from("sessions")
      .select(
        "id, batch_id, subject_id, scheduled_start, scheduled_end, is_live_class, status, yt_broadcast_id, yt_video_id",
      )
      .eq("id", session_id)
      .maybeSingle();
    if (sErr) return jsonError(500, "session lookup failed", origin, sErr.message);
    if (!session) return jsonError(404, "session not found", origin);
    if (!session.is_live_class) {
      return jsonError(400, "session is not a live class", origin);
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

    // Already broadcasting -> re-issue the ingestion details (idempotent).
    if (session.yt_broadcast_id) {
      try {
        const b = await getBroadcast(session.yt_broadcast_id as string);
        const ingestion = b?.boundStreamId
          ? await getStreamIngestion(b.boundStreamId)
          : null;
        return json(
          200,
          {
            status: "existing",
            broadcast_id: session.yt_broadcast_id,
            video_id: session.yt_video_id,
            life_cycle_status: b?.lifeCycleStatus ?? null,
            rtmp_url: ingestion?.rtmpUrl ?? null,
            stream_key: ingestion?.streamKey ?? null,
            backup_rtmp_url: ingestion?.backupRtmpUrl ?? null,
          },
          origin,
        );
      } catch (err) {
        if (err instanceof YtNotConfiguredError) {
          return jsonError(503, "YouTube not configured", origin, err.missing);
        }
        if (err instanceof YtApiError) {
          return jsonError(502, "youtube api error", origin, {
            status: err.status,
            body: err.body,
          });
        }
        throw err;
      }
    }

    // Compose a human title from batch + subject.
    const { data: batch } = await admin
      .from("batches")
      .select("name")
      .eq("id", session.batch_id as string)
      .maybeSingle();
    let subjectName: string | null = null;
    if (session.subject_id) {
      const { data: subj } = await admin
        .from("subjects")
        .select("name")
        .eq("id", session.subject_id as string)
        .maybeSingle();
      subjectName = (subj?.name as string | undefined) ?? null;
    }
    const batchName = (batch?.name as string | undefined) ?? "Live Class";
    const title = `${subjectName ?? "Live Class"} · ${batchName}`;

    // YouTube rejects a scheduledStartTime in the past; for "start now" classes
    // nudge it a minute into the future.
    const nowMs = Date.now();
    const startMs = new Date(session.scheduled_start as string).getTime();
    const scheduledStartTime = new Date(
      Number.isFinite(startMs) && startMs > nowMs ? startMs : nowMs + 60_000,
    ).toISOString();

    let created;
    let stream;
    try {
      created = await createBroadcast({
        title,
        description: `FyneStudy live class — ${batchName}`,
        scheduledStartTime,
      });
      stream = await createStream({ title });
      await bindBroadcast(created.broadcastId, stream.streamId);
    } catch (err) {
      if (err instanceof YtNotConfiguredError) {
        return jsonError(503, "YouTube not configured", origin, err.missing);
      }
      if (err instanceof YtApiError) {
        return jsonError(502, "youtube api error", origin, {
          status: err.status,
          body: err.body,
        });
      }
      throw err;
    }

    const { error: uErr } = await admin
      .from("sessions")
      .update({
        yt_broadcast_id: created.broadcastId,
        yt_video_id: created.videoId,
      })
      .eq("id", session_id);
    if (uErr) return jsonError(500, "session update failed", origin, uErr.message);

    await writeAudit(admin, {
      actor_user_id: caller.app_user_id,
      actor_role: isAdmin ? adminRoleFor(caller) : "teacher",
      action: "yt_broadcast_created",
      entity_table: "sessions",
      entity_id: session_id,
      before_data: { yt_broadcast_id: null },
      // stream_id is not secret; the stream KEY is intentionally never logged.
      after_data: {
        yt_broadcast_id: created.broadcastId,
        yt_video_id: created.videoId,
        stream_id: stream.streamId,
      },
      ip_address: clientIp(req),
      user_agent: req.headers.get("user-agent"),
    });

    return json(
      200,
      {
        status: "created",
        broadcast_id: created.broadcastId,
        video_id: created.videoId,
        rtmp_url: stream.rtmpUrl,
        stream_key: stream.streamKey,
        backup_rtmp_url: stream.backupRtmpUrl,
      },
      origin,
    );
  } catch (err) {
    if (err instanceof AuthError) return jsonError(err.status, err.message, origin);
    console.error("yt-broadcast-create error:", err);
    return jsonError(500, "internal error", origin);
  }
});
