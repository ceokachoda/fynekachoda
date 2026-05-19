// Phase 5 follow-up — `content-pdf-sign`.
//
// WHY THIS EXISTS: Storage RLS denies direct client access to all
// `storage.objects` (migration 20260518091000_storage_content_buckets.sql).
// `supabase.storage.from(...).createSignedUrl(path, ttl)` requires SELECT
// on storage.objects, so students cannot create signed URLs themselves.
// This fn does the RLS check against `content_items` via the user-client
// (proving the caller can see the row), then service-roles the signed URL
// creation. The pattern mirrors `yt-playback-sign` for video.
//
// Input:  { content_id }
// Output: { signed_url, expires_at, file_path }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { handlePreflight } from "../_shared/cors.ts";
import { json, jsonError } from "../_shared/response.ts";
import { getServiceRoleClient, getUserClient } from "../_shared/supabase.ts";
import { AuthError, loadCaller } from "../_shared/auth.ts";
import { ContentPdfSignInputSchema } from "../_shared/schemas.ts";

const STUDY_BUCKET = "study-materials";
const SIGNED_URL_TTL_SEC = 60 * 60; // 1h per D-117

Deno.serve(async (req: Request) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  const origin = req.headers.get("Origin");
  if (req.method !== "POST") return jsonError(405, "method not allowed", origin);

  try {
    const caller = await loadCaller(req);
    const rawBody = await req.json().catch(() => null);
    if (rawBody === null) return jsonError(400, "invalid JSON body", origin);
    const parsed = ContentPdfSignInputSchema.safeParse(rawBody);
    if (!parsed.success) {
      return jsonError(400, "validation failed", origin, parsed.error.issues);
    }
    const { content_id } = parsed.data;

    // RLS-scoped read via user client. If the caller can't see the row,
    // they can't get a signed URL.
    const userClient = getUserClient(req.headers.get("Authorization")!);
    const { data: item, error: itemErr } = await userClient
      .from("content_items")
      .select("id, kind, file_path, is_published")
      .eq("id", content_id)
      .maybeSingle();
    if (itemErr) {
      return jsonError(500, "content lookup failed", origin, itemErr.message);
    }
    if (!item) {
      return jsonError(404, "content not found or not visible", origin);
    }
    if (item.kind === "video" || !item.file_path) {
      return jsonError(400, "content is not a pdf/note", origin);
    }
    if (!item.is_published) {
      const isAdmin = caller.roles.includes("owner_admin") ||
        caller.roles.includes("staff_admin");
      if (!isAdmin) return jsonError(404, "content not published", origin);
    }

    const admin = getServiceRoleClient();
    const { data: signed, error: signErr } = await admin.storage
      .from(STUDY_BUCKET)
      .createSignedUrl(item.file_path, SIGNED_URL_TTL_SEC);
    if (signErr || !signed?.signedUrl) {
      return jsonError(
        500,
        "could not sign url",
        origin,
        signErr?.message ?? "no signedUrl returned",
      );
    }

    const expiresAt = new Date(Date.now() + SIGNED_URL_TTL_SEC * 1000)
      .toISOString();
    return json(
      200,
      {
        signed_url: signed.signedUrl,
        expires_at: expiresAt,
        file_path: item.file_path,
      },
      origin,
    );
  } catch (err) {
    if (err instanceof AuthError) {
      return jsonError(err.status, err.message, origin);
    }
    console.error("content-pdf-sign error:", err);
    return jsonError(500, "internal error", origin);
  }
});
