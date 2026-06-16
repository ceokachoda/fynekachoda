// Phase 5 CP6 — `content-create-video`.
//
// Caller: teacher (assigned to a batch in the topic's course) or admin.
// Input:  { yt_url_or_id, topic_id, title, description?, batch_id? }
// Output: { content_item: <row> }
//
// Verifies via YouTube Data API v3 that the video:
//   - exists,
//   - belongs to INSTITUTE_CHANNEL_ID (Vault),
//   - has privacyStatus = 'unlisted'.
// If verified, parses contentDetails.duration → seconds and inserts a
// content_items row with kind='video', yt_video_id, duration_sec.
//
// Vault secrets used:
//   - YT_DATA_API_KEY     (or YOUTUBE_API_KEY — both names tried, ops setup)
//   - INSTITUTE_CHANNEL_ID
// When YT_DATA_API_KEY is absent we accept the video without channel/privacy
// verification (Phase 5 dev workaround); the validation strictness becomes a
// Phase 9 ops checklist item.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { handlePreflight } from "../_shared/cors.ts";
import { json, jsonError } from "../_shared/response.ts";
import { getServiceRoleClient } from "../_shared/supabase.ts";
import { AuthError, adminRoleFor, loadCaller } from "../_shared/auth.ts";
import { ContentCreateVideoInputSchema } from "../_shared/schemas.ts";
import { clientIp, writeAudit } from "../_shared/audit.ts";
import { notifyStudents } from "../_shared/notify.ts";
import { getVaultSecret, VaultError } from "../_shared/vault.ts";
import {
  fetchYouTubeVideoMeta,
  parseYouTubeId,
  YouTubeApiError,
} from "../_shared/youtube.ts";

function isAdmin(roles: string[]): boolean {
  return roles.includes("owner_admin") || roles.includes("staff_admin");
}

const MAX_DURATION_SEC = 3 * 60 * 60; // D-063

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
    const parsed = ContentCreateVideoInputSchema.safeParse(rawBody);
    if (!parsed.success) {
      return jsonError(400, "validation failed", origin, parsed.error.issues);
    }
    const { yt_url_or_id, topic_id, title, description, batch_id } =
      parsed.data;

    const videoId = parseYouTubeId(yt_url_or_id);
    if (!videoId) {
      return jsonError(400, "could not parse YouTube id from input", origin);
    }

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

    // Duplicate-detection: same yt_video_id already in this course.
    const { data: existing, error: existingErr } = await admin
      .from("content_items")
      .select("id")
      .eq("yt_video_id", videoId)
      .maybeSingle();
    if (existingErr) {
      return jsonError(
        500,
        "duplicate check failed",
        origin,
        existingErr.message,
      );
    }
    if (existing) {
      return jsonError(409, "this video is already in the library", origin);
    }

    let durationSec: number | null = null;
    let verified = false;

    let apiKey: string | null = null;
    try {
      apiKey = (await getVaultSecret("YT_DATA_API_KEY")) ??
        (await getVaultSecret("YOUTUBE_API_KEY"));
    } catch (e) {
      if (!(e instanceof VaultError)) throw e;
      apiKey = null;
    }
    let instituteChannelId: string | null = null;
    try {
      instituteChannelId = await getVaultSecret("INSTITUTE_CHANNEL_ID");
    } catch (e) {
      if (!(e instanceof VaultError)) throw e;
      instituteChannelId = null;
    }

    if (apiKey) {
      let meta;
      try {
        meta = await fetchYouTubeVideoMeta(videoId, apiKey);
      } catch (e) {
        if (e instanceof YouTubeApiError) {
          return jsonError(502, `youtube api ${e.status}`, origin, e.message);
        }
        throw e;
      }
      if (!meta) {
        return jsonError(404, "video not found on YouTube", origin);
      }
      if (
        instituteChannelId && meta.channelId &&
        meta.channelId !== instituteChannelId
      ) {
        return jsonError(
          400,
          "video must be uploaded to the institute channel",
          origin,
        );
      }
      if (meta.privacyStatus !== "unlisted") {
        return jsonError(
          400,
          `video must be Unlisted (current: ${meta.privacyStatus})`,
          origin,
        );
      }
      if (meta.durationSec > MAX_DURATION_SEC) {
        return jsonError(
          400,
          `video exceeds ${MAX_DURATION_SEC}s max (D-063)`,
          origin,
        );
      }
      durationSec = meta.durationSec;
      verified = true;
    }

    // Course-wide proposals by teacher → unpublished (admin approval).
    const is_published = callerIsAdmin || batch_id !== undefined;

    const { data: inserted, error: insertErr } = await admin
      .from("content_items")
      .insert({
        kind: "video",
        title,
        description: description ?? null,
        topic_id,
        batch_id: batch_id ?? null,
        course_id: courseId,
        yt_video_id: videoId,
        duration_sec: durationSec,
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
      action: "content_create_video",
      entity_table: "content_items",
      entity_id: inserted.id,
      after_data: { ...inserted, _yt_verified: verified },
      ip_address: clientIp(req),
      user_agent: req.headers.get("user-agent"),
    });

    if (is_published) {
      notifyStudents(
        batch_id ? { batch_id } : { course_id: courseId },
        {
          title: "New video lesson",
          body: `"${title}" is now in your library. Tap to watch.`,
          data: { type: "new_content", id: inserted.id, kind: "video" },
        },
      );
    }

    return json(200, { content_item: inserted, yt_verified: verified }, origin);
  } catch (err) {
    if (err instanceof AuthError) {
      return jsonError(err.status, err.message, origin);
    }
    if (err instanceof VaultError) {
      console.error("content-create-video vault error:", err.message);
      return jsonError(500, "vault unavailable", origin);
    }
    console.error("content-create-video error:", err);
    return jsonError(500, "internal error", origin);
  }
});
