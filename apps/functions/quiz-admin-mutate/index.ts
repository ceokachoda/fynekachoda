// Phase 6 CP11 — `quiz-admin-mutate` edge fn.
//
// Admin moderation surface for the /quizzes and /questions pages.
// Discriminated-union body mirrors `curriculum-mutate` / `batch-mutate`
// (D-151). All ops capture `before / after` audit rows (D-093, D-172).
//
// Ops:
//   - toggle_publish_quiz { quiz_id, is_published }
//   - delete_quiz          { quiz_id }   — cascades to attempts/answers
//   - archive_question     { question_id, is_archived }
//   - delete_question      { question_id } — fails if any quiz still uses it

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { handlePreflight } from "../_shared/cors.ts";
import { json, jsonError } from "../_shared/response.ts";
import { getServiceRoleClient } from "../_shared/supabase.ts";
import { AuthError, adminRoleFor, loadCaller } from "../_shared/auth.ts";
import { QuizAdminMutateInputSchema } from "../_shared/schemas.ts";
import { clientIp, writeAudit } from "../_shared/audit.ts";
import { notifyStudents } from "../_shared/notify.ts";

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
    if (!isAdmin(caller.roles)) {
      return jsonError(403, "admin only", origin);
    }

    const rawBody = await req.json().catch(() => null);
    if (rawBody === null) return jsonError(400, "invalid JSON body", origin);
    const parsed = QuizAdminMutateInputSchema.safeParse(rawBody);
    if (!parsed.success) {
      return jsonError(400, "validation failed", origin, parsed.error.issues);
    }

    const admin = getServiceRoleClient();
    const actorRole = adminRoleFor(caller);
    const ip = clientIp(req);
    const ua = req.headers.get("user-agent");

    switch (parsed.data.op) {
      case "toggle_publish_quiz": {
        const { quiz_id, is_published } = parsed.data;
        const { data: before, error: bErr } = await admin
          .from("quizzes")
          .select("*")
          .eq("id", quiz_id)
          .maybeSingle();
        if (bErr) {
          return jsonError(500, "quiz lookup failed", origin, bErr.message);
        }
        if (!before) return jsonError(404, "quiz not found", origin);
        const { data: after, error: uErr } = await admin
          .from("quizzes")
          .update({ is_published })
          .eq("id", quiz_id)
          .select("*")
          .single();
        if (uErr) {
          return jsonError(500, "update failed", origin, uErr.message);
        }
        await writeAudit(admin, {
          actor_user_id: caller.app_user_id,
          actor_role: actorRole,
          action: is_published ? "quiz_publish" : "quiz_unpublish",
          entity_table: "quizzes",
          entity_id: quiz_id,
          before_data: before,
          after_data: after,
          ip_address: ip,
          user_agent: ua,
        });
        // First publish -> tell students a new practice quiz is available.
        if (is_published && !before.is_published) {
          notifyStudents(
            after.batch_id ? { batch_id: after.batch_id } : { course_id: after.course_id },
            {
              title: "New practice quiz",
              body: `"${after.title}" is ready. Tap to attempt it.`,
              data: { type: "new_quiz", id: quiz_id },
            },
          );
        }
        return json(200, { quiz: after }, origin);
      }

      case "delete_quiz": {
        const { quiz_id } = parsed.data;
        const { data: before, error: bErr } = await admin
          .from("quizzes")
          .select("*")
          .eq("id", quiz_id)
          .maybeSingle();
        if (bErr) {
          return jsonError(500, "quiz lookup failed", origin, bErr.message);
        }
        if (!before) return jsonError(404, "quiz not found", origin);
        const { error: dErr } = await admin
          .from("quizzes")
          .delete()
          .eq("id", quiz_id);
        if (dErr) {
          return jsonError(500, "delete failed", origin, dErr.message);
        }
        await writeAudit(admin, {
          actor_user_id: caller.app_user_id,
          actor_role: actorRole,
          action: "quiz_delete",
          entity_table: "quizzes",
          entity_id: quiz_id,
          before_data: before,
          ip_address: ip,
          user_agent: ua,
        });
        return json(200, { deleted: true }, origin);
      }

      case "archive_question": {
        const { question_id, is_archived } = parsed.data;
        const { data: before, error: bErr } = await admin
          .from("questions")
          .select("*")
          .eq("id", question_id)
          .maybeSingle();
        if (bErr) {
          return jsonError(500, "question lookup failed", origin, bErr.message);
        }
        if (!before) return jsonError(404, "question not found", origin);
        const { data: after, error: uErr } = await admin
          .from("questions")
          .update({ is_archived })
          .eq("id", question_id)
          .select("*")
          .single();
        if (uErr) {
          return jsonError(500, "update failed", origin, uErr.message);
        }
        await writeAudit(admin, {
          actor_user_id: caller.app_user_id,
          actor_role: actorRole,
          action: is_archived ? "question_archive" : "question_unarchive",
          entity_table: "questions",
          entity_id: question_id,
          before_data: before,
          after_data: after,
          ip_address: ip,
          user_agent: ua,
        });
        return json(200, { question: after }, origin);
      }

      case "delete_question": {
        const { question_id } = parsed.data;
        // The FK `quiz_questions.question_id` is ON DELETE RESTRICT — if any
        // quiz still references this question, we surface a 409 rather than
        // failing late at the storage layer.
        const { count: refCount, error: refErr } = await admin
          .from("quiz_questions")
          .select("question_id", { count: "exact", head: true })
          .eq("question_id", question_id);
        if (refErr) {
          return jsonError(500, "reference lookup failed", origin, refErr.message);
        }
        if ((refCount ?? 0) > 0) {
          return jsonError(
            409,
            "question still used by quizzes — archive instead",
            origin,
            { quiz_count: refCount },
          );
        }
        const { data: before, error: bErr } = await admin
          .from("questions")
          .select("*")
          .eq("id", question_id)
          .maybeSingle();
        if (bErr) {
          return jsonError(500, "question lookup failed", origin, bErr.message);
        }
        if (!before) return jsonError(404, "question not found", origin);
        const { error: dErr } = await admin
          .from("questions")
          .delete()
          .eq("id", question_id);
        if (dErr) {
          return jsonError(500, "delete failed", origin, dErr.message);
        }
        await writeAudit(admin, {
          actor_user_id: caller.app_user_id,
          actor_role: actorRole,
          action: "question_delete",
          entity_table: "questions",
          entity_id: question_id,
          before_data: before,
          ip_address: ip,
          user_agent: ua,
        });
        return json(200, { deleted: true }, origin);
      }
    }
  } catch (err) {
    if (err instanceof AuthError) {
      return jsonError(err.status, err.message, origin);
    }
    console.error("quiz-admin-mutate error:", err);
    return jsonError(500, "internal error", origin);
  }
});
