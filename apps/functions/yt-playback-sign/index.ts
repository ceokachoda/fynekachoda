// Phase 5 CP7 — `yt-playback-sign`.
//
// Caller: any authenticated student/teacher/admin.
// Input:  { content_id }
// Output: { envelope: <base64url>, exp, watermark, kind, video_id }
//
// Verifies the caller can SEE the row via RLS by using a user-client (NOT
// the service-role client) for the fetch — the same RLS that hides
// batch-scoped content from other batches blocks the sign here too. Then
// composes a 4h signed envelope including the watermark text (D-045).
// The video_id is INCLUDED in the response (the wrapped player needs it to
// load the iframe — D-042 says the *client* doesn't see it via DOM, but the
// signed payload IS the controlled channel).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { handlePreflight } from "../_shared/cors.ts";
import { json, jsonError } from "../_shared/response.ts";
import { getServiceRoleClient, getUserClient } from "../_shared/supabase.ts";
import { AuthError, loadCaller } from "../_shared/auth.ts";
import { YtPlaybackSignInputSchema } from "../_shared/schemas.ts";
import { getPlaybackSecrets, VaultError } from "../_shared/vault.ts";
import {
  encodePlaybackEnvelope,
  type PlaybackPayload,
  signPlayback,
} from "../_shared/playback.ts";
import { formatWatermark } from "../_shared/watermark.ts";

const PAYLOAD_TTL_SEC = 4 * 60 * 60; // 4h video; D-042

Deno.serve(async (req: Request) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  const origin = req.headers.get("Origin");

  if (req.method !== "POST") return jsonError(405, "method not allowed", origin);

  try {
    const caller = await loadCaller(req);
    const rawBody = await req.json().catch(() => null);
    if (rawBody === null) return jsonError(400, "invalid JSON body", origin);
    const parsed = YtPlaybackSignInputSchema.safeParse(rawBody);
    if (!parsed.success) {
      return jsonError(400, "validation failed", origin, parsed.error.issues);
    }
    const { content_id } = parsed.data;

    // RLS-scoped read via user client (D-042: caller must be allowed to see
    // this content, otherwise no token issued).
    const authHeader = req.headers.get("Authorization")!;
    const userClient = getUserClient(authHeader);
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
      // Admin can still play unpublished content (they pass RLS).
      const isAdmin = caller.roles.includes("owner_admin") ||
        caller.roles.includes("staff_admin");
      if (!isAdmin) return jsonError(404, "content not published", origin);
    }

    // Watermark: read first name + phone from app_users.
    const admin = getServiceRoleClient();
    const { data: callerRow, error: callerErr } = await admin
      .from("app_users")
      .select("full_name, phone")
      .eq("id", caller.app_user_id)
      .maybeSingle();
    if (callerErr) {
      return jsonError(500, "caller lookup failed", origin, callerErr.message);
    }
    const watermark = formatWatermark(
      callerRow?.full_name ?? caller.full_name,
      callerRow?.phone,
    );

    const secrets = await getPlaybackSecrets();
    const payload: PlaybackPayload = {
      v: 1,
      kind: "lesson",
      video_id: item.yt_video_id,
      watermark,
      content_id: item.id,
      session_id: null,
      uid: caller.app_user_id,
      exp: Math.floor(Date.now() / 1000) + PAYLOAD_TTL_SEC,
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
