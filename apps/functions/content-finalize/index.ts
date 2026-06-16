// Phase 5 CP5 — `content-finalize`.
//
// Caller: teacher/admin who previously called `content-presign-upload`.
// Input:  { kind: 'pdf'|'note', topic_id, title, description?, batch_id?, file_path, file_size_bytes?, mime_type? }
// Output: { content_item: <row> }
//
// Verifies the uploaded object exists at file_path under `study-materials`
// (HEAD via storage list), then inserts a `content_items` row and writes an
// `audit_log` entry. Default state: `is_published = true` for teacher's own
// batch uploads; `is_published = false` for course-wide promotions (admin
// approval pending).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { handlePreflight } from "../_shared/cors.ts";
import { json, jsonError } from "../_shared/response.ts";
import { getServiceRoleClient } from "../_shared/supabase.ts";
import { AuthError, loadCaller } from "../_shared/auth.ts";
import { ContentFinalizeInputSchema } from "../_shared/schemas.ts";
import { adminRoleFor } from "../_shared/auth.ts";
import { clientIp, writeAudit } from "../_shared/audit.ts";
import { notifyStudents } from "../_shared/notify.ts";

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
    const parsed = ContentFinalizeInputSchema.safeParse(rawBody);
    if (!parsed.success) {
      return jsonError(400, "validation failed", origin, parsed.error.issues);
    }
    const {
      kind,
      topic_id,
      title,
      description,
      batch_id,
      file_path,
      file_size_bytes,
      mime_type,
    } = parsed.data;

    const admin = getServiceRoleClient();

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

    // Verify file existence under study-materials. Storage list with a search
    // filter equals a directory scoped lookup; we limit to 1 to keep it cheap.
    const lastSlash = file_path.lastIndexOf("/");
    const dir = lastSlash >= 0 ? file_path.slice(0, lastSlash) : "";
    const fname = file_path.slice(lastSlash + 1);
    const { data: listed, error: listErr } = await admin.storage
      .from(STUDY_BUCKET)
      .list(dir, { limit: 100, search: fname });
    if (listErr) {
      return jsonError(500, "storage list failed", origin, listErr.message);
    }
    const found = (listed ?? []).find((o) => o.name === fname);
    if (!found) {
      return jsonError(404, "file not present at path", origin);
    }

    // Optional sanity: file_path must start with `{course_id}/{topic_id}/`.
    if (!file_path.startsWith(`${courseId}/${topic_id}/`)) {
      return jsonError(400, "file_path scope mismatch", origin);
    }

    // Course-wide upload by a teacher → unpublished (admin must approve).
    // Admin uploads or batch-scoped uploads → published.
    const is_published = callerIsAdmin || batch_id !== undefined;

    const { data: inserted, error: insertErr } = await admin
      .from("content_items")
      .insert({
        kind,
        title,
        description: description ?? null,
        topic_id,
        batch_id: batch_id ?? null,
        course_id: courseId,
        file_path,
        file_size_bytes: file_size_bytes ?? null,
        mime_type: mime_type ?? "application/pdf",
        uploaded_by: caller.app_user_id,
        is_published,
      })
      .select("*")
      .single();
    if (insertErr) {
      return jsonError(
        500,
        "content_items insert failed",
        origin,
        insertErr.message,
      );
    }

    await writeAudit(admin, {
      actor_user_id: caller.app_user_id,
      actor_role: adminRoleFor(caller) ?? (callerIsTeacher ? "teacher" : null),
      action: kind === "pdf" ? "content_create_pdf" : "content_create_note",
      entity_table: "content_items",
      entity_id: inserted.id,
      after_data: inserted,
      ip_address: clientIp(req),
      user_agent: req.headers.get("user-agent"),
    });

    // New library item is immediately student-visible -> notify its audience.
    if (is_published) {
      notifyStudents(
        batch_id ? { batch_id } : { course_id: courseId },
        {
          title: "New study material",
          body: `"${title}" was added to your library.`,
          data: { type: "new_content", id: inserted.id, kind },
        },
      );
    }

    return json(200, { content_item: inserted }, origin);
  } catch (err) {
    if (err instanceof AuthError) {
      return jsonError(err.status, err.message, origin);
    }
    console.error("content-finalize error:", err);
    return jsonError(500, "internal error", origin);
  }
});
