// Phase 6 CP6 — `quiz-image-presign` edge fn.
//
// Caller: teacher or admin.
// Input:  { kind: 'question_prompt'|'option_image', mime_type, content_size_bytes }
// Output: { upload_url, path, token, bucket, expires_at }
//
// Storage path convention: `{uploader_user_id}/{kind}/{uuid}.{ext}`.
// Bucket: `exam-images` (private, ≤ 5 MB image, jpeg/png/webp). D-117 + D-058.
// Mobile client PUTs the file directly, then quiz-builder writes the path
// onto `questions.prompt_image_path` / `question_options.image_path` via
// PostgREST.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { handlePreflight } from "../_shared/cors.ts";
import { json, jsonError } from "../_shared/response.ts";
import { getServiceRoleClient } from "../_shared/supabase.ts";
import { AuthError, loadCaller } from "../_shared/auth.ts";
import {
  EXAM_IMAGE_MAX_BYTES,
  QuizImagePresignInputSchema,
} from "../_shared/schemas.ts";

const EXAM_BUCKET = "exam-images";

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function isAdmin(roles: string[]): boolean {
  return roles.includes("owner_admin") || roles.includes("staff_admin");
}

Deno.serve(async (req: Request) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  const origin = req.headers.get("Origin");

  if (req.method !== "POST") {
    return jsonError(405, "method not allowed", origin);
  }

  try {
    const caller = await loadCaller(req);
    const callerIsAdmin = isAdmin(caller.roles);
    const callerIsTeacher = caller.roles.includes("teacher");
    if (!callerIsAdmin && !callerIsTeacher) {
      return jsonError(403, "teacher or admin required", origin);
    }

    const rawBody = await req.json().catch(() => null);
    if (rawBody === null) return jsonError(400, "invalid JSON body", origin);
    const parsed = QuizImagePresignInputSchema.safeParse(rawBody);
    if (!parsed.success) {
      return jsonError(400, "validation failed", origin, parsed.error.issues);
    }
    const { kind, mime_type, content_size_bytes } = parsed.data;

    if (content_size_bytes > EXAM_IMAGE_MAX_BYTES) {
      return jsonError(413, "file too large (max 5 MB)", origin);
    }
    const ext = EXT_BY_MIME[mime_type];
    if (!ext) return jsonError(415, "unsupported mime type", origin);

    const admin = getServiceRoleClient();

    const uuid = crypto.randomUUID();
    const path = `${caller.app_user_id}/${kind}/${uuid}.${ext}`;

    const { data: signed, error: signedErr } = await admin.storage
      .from(EXAM_BUCKET)
      .createSignedUploadUrl(path);
    if (signedErr || !signed) {
      return jsonError(
        500,
        "signed upload url failed",
        origin,
        signedErr?.message,
      );
    }

    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

    return json(
      200,
      {
        upload_url: signed.signedUrl,
        path,
        token: signed.token,
        bucket: EXAM_BUCKET,
        kind,
        expires_at: expiresAt,
      },
      origin,
    );
  } catch (err) {
    if (err instanceof AuthError) {
      return jsonError(err.status, err.message, origin);
    }
    console.error("quiz-image-presign error:", err);
    return jsonError(500, "internal error", origin);
  }
});
