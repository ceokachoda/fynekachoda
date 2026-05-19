// Phase 5 CP4 — `content-presign-upload`.
//
// Caller: teacher (owner of a batch in the topic's course) or admin.
// Input:  { kind: 'pdf'|'note', topic_id, title, batch_id?, content_size_bytes, mime_type }
// Output: { upload_url, path, token, expires_at, course_id }
//
// Storage is private (D-117). The signed upload URL is short-lived (Supabase
// default ~2h). The mobile client PUTs the file directly to Storage, then
// calls `content-finalize` to insert the `content_items` row.
//
// Authorization rules:
//   - Caller must be teacher (and assigned to at least one batch in the
//     topic's course) OR admin.
//   - If `batch_id` is provided, teacher must be assigned to that batch.
//   - File size ≤ 50 MB (D-063); mime ∈ {application/pdf} (D-061).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { handlePreflight } from "../_shared/cors.ts";
import { json, jsonError } from "../_shared/response.ts";
import { getServiceRoleClient } from "../_shared/supabase.ts";
import { AuthError, loadCaller } from "../_shared/auth.ts";
import {
  ContentPresignUploadInputSchema,
  PDF_MAX_BYTES,
} from "../_shared/schemas.ts";

const STUDY_BUCKET = "study-materials";

function isAdmin(roles: string[]): boolean {
  return roles.includes("owner_admin") || roles.includes("staff_admin");
}

Deno.serve(async (req: Request) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  const origin = req.headers.get("Origin");

  if (req.method !== "POST") return jsonError(405, "method not allowed", origin);

  try {
    const caller = await loadCaller(req);
    const callerIsAdmin = isAdmin(caller.roles);
    const callerIsTeacher = caller.roles.includes("teacher");
    if (!callerIsAdmin && !callerIsTeacher) {
      return jsonError(403, "teacher or admin required", origin);
    }

    const rawBody = await req.json().catch(() => null);
    if (rawBody === null) return jsonError(400, "invalid JSON body", origin);
    const parsed = ContentPresignUploadInputSchema.safeParse(rawBody);
    if (!parsed.success) {
      return jsonError(400, "validation failed", origin, parsed.error.issues);
    }
    const { kind, topic_id, batch_id, content_size_bytes, mime_type } =
      parsed.data;

    if (content_size_bytes > PDF_MAX_BYTES) {
      return jsonError(413, "file too large (max 50 MB)", origin);
    }

    const admin = getServiceRoleClient();

    // Derive course_id from the topic chain.
    const { data: topic, error: topicErr } = await admin
      .from("topics")
      .select(
        "id, name, chapter:chapters!chapter_id(id, subject:subjects!subject_id(id, course_id))",
      )
      .eq("id", topic_id)
      .maybeSingle();
    if (topicErr) {
      return jsonError(500, "topic lookup failed", origin, topicErr.message);
    }
    if (!topic) return jsonError(404, "topic not found", origin);
    // deno-lint-ignore no-explicit-any
    const courseId = (topic as any).chapter?.subject?.course_id as
      | string
      | undefined;
    if (!courseId) {
      return jsonError(409, "topic missing course chain", origin);
    }

    // Teacher must be assigned to at least one batch in this course.
    if (!callerIsAdmin) {
      const { data: btRows, error: btErr } = await admin
        .from("batch_teachers")
        .select("batch_id, batches!inner(id, course_id)")
        .eq("teacher_id", caller.app_user_id)
        .eq("batches.course_id", courseId);
      if (btErr) {
        return jsonError(
          500,
          "teacher-batch lookup failed",
          origin,
          btErr.message,
        );
      }
      if (!btRows || btRows.length === 0) {
        return jsonError(403, "no batches for this course", origin);
      }
      if (batch_id) {
        const ok = btRows.some((r) => r.batch_id === batch_id);
        if (!ok) return jsonError(403, "not assigned to batch", origin);
      }
    } else if (batch_id) {
      const { data: batchRow, error: batchErr } = await admin
        .from("batches")
        .select("id, course_id")
        .eq("id", batch_id)
        .maybeSingle();
      if (batchErr || !batchRow) {
        return jsonError(404, "batch not found", origin);
      }
      if (batchRow.course_id !== courseId) {
        return jsonError(409, "batch course mismatch", origin);
      }
    }

    if (mime_type !== "application/pdf") {
      return jsonError(415, "unsupported mime type", origin);
    }

    const fileUuid = crypto.randomUUID();
    const path = `${courseId}/${topic_id}/${fileUuid}.pdf`;

    const { data: signed, error: signedErr } = await admin.storage
      .from(STUDY_BUCKET)
      .createSignedUploadUrl(path);
    if (signedErr || !signed) {
      return jsonError(
        500,
        "signed upload url failed",
        origin,
        signedErr?.message,
      );
    }

    // Supabase's createSignedUploadUrl returns `{ signedUrl, path, token }`
    // where `token` is what the client passes to `uploadToSignedUrl(path, token, file)`.
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

    return json(
      200,
      {
        upload_url: signed.signedUrl,
        path,
        token: signed.token,
        expires_at: expiresAt,
        course_id: courseId,
        bucket: STUDY_BUCKET,
        kind,
      },
      origin,
    );
  } catch (err) {
    if (err instanceof AuthError) {
      return jsonError(err.status, err.message, origin);
    }
    console.error("content-presign-upload error:", err);
    return jsonError(500, "internal error", origin);
  }
});
