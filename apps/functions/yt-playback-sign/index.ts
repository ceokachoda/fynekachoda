// Phase 5 CP7 + Phase 9 CP6 — `yt-playback-sign`.
//
// Caller: any authenticated student/teacher/admin.
// Input (one of):
//   { content_id }                       -> library lesson (Phase 5, unchanged)
//   { session_id, kind: 'live' }         -> live class playback (Phase 9)
//   { session_id, kind: 'recording' }    -> ended-class recording (Phase 9)
// Output: { envelope, exp, watermark, kind, video_id }
//
// Access is enforced by reading the underlying row with a USER client (NOT the
// service-role client): the same RLS that hides batch-scoped content/sessions
// from other batches blocks the sign here too (D-042). The signed envelope
// carries the video_id + viewer watermark; the wrapped player needs the id to
// load the iframe, but it never reaches the DOM as a separate field.
//
// Live/recording issuances are audited (leak-detection: a spike of repeated
// sign calls by one viewer is a flag).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { handlePreflight } from "../_shared/cors.ts";
import { json, jsonError } from "../_shared/response.ts";
import { getServiceRoleClient, getUserClient } from "../_shared/supabase.ts";
import { AuthError, loadCaller } from "../_shared/auth.ts";
import {
  YtPlaybackSignInputSchema,
  YtPlaybackSignSessionInputSchema,
} from "../_shared/schemas.ts";
import { getPlaybackSecrets, VaultError } from "../_shared/vault.ts";
import {
  encodePlaybackEnvelope,
  type PlaybackPayload,
  signPlayback,
} from "../_shared/playback.ts";
import { formatWatermark } from "../_shared/watermark.ts";
import { clientIp, writeAudit } from "../_shared/audit.ts";

const LESSON_TTL_SEC = 4 * 60 * 60; // 4h (D-042)
const LIVE_TTL_SEC = 60 * 60; // 1h
const RECORDING_TTL_SEC = 4 * 60 * 60; // 4h

Deno.serve(async (req: Request) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  const origin = req.headers.get("Origin");

  if (req.method !== "POST") return jsonError(405, "method not allowed", origin);

  try {
    const caller = await loadCaller(req);
    const rawBody = await req.json().catch(() => null);
    if (rawBody === null) return jsonError(400, "invalid JSON body", origin);

    const authHeader = req.headers.get("Authorization")!;
    const userClient = getUserClient(authHeader);
    const admin = getServiceRoleClient();
    const secrets = await getPlaybackSecrets();

    async function watermarkFor(): Promise<string> {
      const { data: row } = await admin
        .from("app_users")
        .select("full_name, phone")
        .eq("id", caller.app_user_id)
        .maybeSingle();
      return formatWatermark(
        (row?.full_name as string | undefined) ?? caller.full_name,
        row?.phone as string | undefined,
      );
    }

    // ---- Phase 9: live / recording session playback ----
    if (rawBody && typeof rawBody === "object" && "session_id" in rawBody) {
      const parsed = YtPlaybackSignSessionInputSchema.safeParse(rawBody);
      if (!parsed.success) {
        return jsonError(400, "validation failed", origin, parsed.error.issues);
      }
      const { session_id, kind } = parsed.data;

      const { data: session, error: sErr } = await userClient
        .from("sessions")
        .select("id, status, yt_video_id")
        .eq("id", session_id)
        .maybeSingle();
      if (sErr) return jsonError(500, "session lookup failed", origin, sErr.message);
      if (!session) return jsonError(404, "session not found or not visible", origin);
      if (!session.yt_video_id) {
        return jsonError(409, "no video for this session yet", origin);
      }
      if (kind === "live" && session.status !== "live") {
        return jsonError(409, "session is not live", origin);
      }
      if (kind === "recording" && session.status !== "ended") {
        return jsonError(409, "recording not available", origin);
      }

      const watermark = await watermarkFor();
      const ttl = kind === "live" ? LIVE_TTL_SEC : RECORDING_TTL_SEC;
      const payload: PlaybackPayload = {
        v: 1,
        kind,
        video_id: session.yt_video_id as string,
        watermark,
        content_id: null,
        session_id,
        uid: caller.app_user_id,
        exp: Math.floor(Date.now() / 1000) + ttl,
      };
      const sig = await signPlayback(payload, secrets[0]!);
      const envelope = encodePlaybackEnvelope({ payload, sig });

      await writeAudit(admin, {
        actor_user_id: caller.app_user_id,
        actor_role: null,
        action: "playback_sign_issued",
        entity_table: "sessions",
        entity_id: session_id,
        after_data: { kind, video_id: session.yt_video_id, exp: payload.exp },
        ip_address: clientIp(req),
        user_agent: req.headers.get("user-agent"),
      });

      return json(
        200,
        {
          envelope,
          video_id: session.yt_video_id,
          kind,
          watermark,
          exp: payload.exp,
        },
        origin,
      );
    }

    // ---- Phase 5: library lesson playback (unchanged) ----
    const parsed = YtPlaybackSignInputSchema.safeParse(rawBody);
    if (!parsed.success) {
      return jsonError(400, "validation failed", origin, parsed.error.issues);
    }
    const { content_id } = parsed.data;

    const { data: item, error: itemErr } = await userClient
      .from("content_items")
      .select("id, kind, yt_video_id, is_published")
      .eq("id", content_id)
      .maybeSingle();
    if (itemErr) {
      return jsonError(500, "content lookup failed", origin, itemErr.message);
    }
    if (!item) return jsonError(404, "content not found or not visible", origin);
    if (item.kind !== "video" || !item.yt_video_id) {
      return jsonError(400, "content is not a video", origin);
    }
    if (!item.is_published) {
      const isAdmin = caller.roles.includes("owner_admin") ||
        caller.roles.includes("staff_admin");
      if (!isAdmin) return jsonError(404, "content not published", origin);
    }

    const watermark = await watermarkFor();
    const payload: PlaybackPayload = {
      v: 1,
      kind: "lesson",
      video_id: item.yt_video_id,
      watermark,
      content_id: item.id,
      session_id: null,
      uid: caller.app_user_id,
      exp: Math.floor(Date.now() / 1000) + LESSON_TTL_SEC,
    };
    const sig = await signPlayback(payload, secrets[0]!);
    const envelope = encodePlaybackEnvelope({ payload, sig });

    return json(
      200,
      {
        envelope,
        video_id: item.yt_video_id,
        kind: payload.kind,
        watermark,
        exp: payload.exp,
      },
      origin,
    );
  } catch (err) {
    if (err instanceof AuthError) {
      return jsonError(err.status, err.message, origin);
    }
    if (err instanceof VaultError) {
      console.error("yt-playback-sign vault error:", err.message);
      return jsonError(500, "vault unavailable", origin);
    }
    console.error("yt-playback-sign error:", err);
    return jsonError(500, "internal error", origin);
  }
});
