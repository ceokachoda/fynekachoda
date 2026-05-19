// Phase 5 CP7 — `yt-thumb-sign`.
//
// Caller: any authenticated user.
// Input:  { content_id }
// Output: { thumbnail_url }
//
// RLS-scoped: only callers who can read the row get a URL back. We return
// the YT-CDN URL directly (per phase-5.md §5.7 — MVP simplicity; the id
// trade-off is already documented in D-042).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { handlePreflight } from "../_shared/cors.ts";
import { json, jsonError } from "../_shared/response.ts";
import { getUserClient } from "../_shared/supabase.ts";
import { AuthError, loadCaller } from "../_shared/auth.ts";
import { YtThumbSignInputSchema } from "../_shared/schemas.ts";

Deno.serve(async (req: Request) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  const origin = req.headers.get("Origin");

  if (req.method !== "POST") return jsonError(405, "method not allowed", origin);

  try {
    await loadCaller(req); // 401 if invalid/suspended
    const rawBody = await req.json().catch(() => null);
    if (rawBody === null) return jsonError(400, "invalid JSON body", origin);
    const parsed = YtThumbSignInputSchema.safeParse(rawBody);
    if (!parsed.success) {
      return jsonError(400, "validation failed", origin, parsed.error.issues);
    }

    const userClient = getUserClient(req.headers.get("Authorization")!);
    const { data: item, error: itemErr } = await userClient
      .from("content_items")
      .select("id, kind, yt_video_id")
      .eq("id", parsed.data.content_id)
      .maybeSingle();
    if (itemErr) {
      return jsonError(500, "content lookup failed", origin, itemErr.message);
    }
    if (!item || item.kind !== "video" || !item.yt_video_id) {
      return jsonError(404, "video not found or not visible", origin);
    }

    const url =
      `https://i.ytimg.com/vi/${encodeURIComponent(item.yt_video_id)}/mqdefault.jpg`;
    return json(200, { thumbnail_url: url }, origin);
  } catch (err) {
    if (err instanceof AuthError) {
      return jsonError(err.status, err.message, origin);
    }
    console.error("yt-thumb-sign error:", err);
    return jsonError(500, "internal error", origin);
  }
});
