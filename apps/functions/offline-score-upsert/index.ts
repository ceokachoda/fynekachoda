// Phase 7 CP9 — `offline-score-upsert` edge fn.
//
// Caller: teacher of the target batch. Input:
//   { batch_id, test_name, test_date, subject_id?, max_score,
//     entries: [{ student_id, score, notes? }] }
//
// Spec §5.9 + §9. UPSERTs `offline_test_scores` per entry on the natural
// key (batch_id, student_id, test_name, test_date). Audits with both
// before/after summaries so a teacher's edit shows the score delta per
// student. Returns counts of inserted vs. updated for UX feedback.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { handlePreflight } from "../_shared/cors.ts";
import { json, jsonError } from "../_shared/response.ts";
import { getServiceRoleClient } from "../_shared/supabase.ts";
import {
  adminRoleFor,
  AuthError,
  loadCaller,
} from "../_shared/auth.ts";
import { OfflineScoreUpsertInputSchema } from "../_shared/schemas.ts";
import { clientIp, writeAudit } from "../_shared/audit.ts";

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
    const isTeacher = caller.roles.includes("teacher");
    const callerIsAdmin = isAdmin(caller.roles);
    if (!isTeacher && !callerIsAdmin) {
      return jsonError(403, "teacher or admin only", origin);
    }

    const rawBody = await req.json().catch(() => null);
    if (rawBody === null) return jsonError(400, "invalid JSON body", origin);
    const parsed = OfflineScoreUpsertInputSchema.safeParse(rawBody);
    if (!parsed.success) {
      return jsonError(400, "validation failed", origin, parsed.error.issues);
    }
    const { batch_id, test_name, test_date, subject_id, max_score, entries } =
      parsed.data;

    const admin = getServiceRoleClient();

    if (!callerIsAdmin) {
      const { data: bt } = await admin
        .from("batch_teachers")
        .select("batch_id")
        .eq("batch_id", batch_id)
        .eq("teacher_id", caller.app_user_id)
        .maybeSingle();
      if (!bt) return jsonError(403, "not your batch", origin);
    }

    // Validate that subject_id (if provided) belongs to the batch's course.
    if (subject_id) {
      const { data: subj } = await admin
        .from("subjects")
        .select("id, course_id, batches:batches!course_id(id)")
        .eq("id", subject_id)
        .maybeSingle();
      const { data: batchRow } = await admin
        .from("batches")
        .select("course_id")
        .eq("id", batch_id)
        .maybeSingle();
      if (!subj || !batchRow || subj.course_id !== batchRow.course_id) {
        return jsonError(400, "subject not in this batch's course", origin);
      }
    }

    // Validate students belong to this batch + score ≤ max.
    const studentIds = entries.map((e) => e.student_id);
    const { data: stuRows } = await admin
      .from("students")
      .select("user_id, batch_id")
      .in("user_id", studentIds);
    const stuById = new Map<string, string>();
    for (const s of stuRows ?? []) stuById.set(s.user_id, s.batch_id);
    for (const e of entries) {
      const sBatch = stuById.get(e.student_id);
      if (!sBatch) {
        return jsonError(400, `student ${e.student_id} not found`, origin);
      }
      if (sBatch !== batch_id) {
        return jsonError(400, `student ${e.student_id} not in this batch`, origin);
      }
      if (e.score < 0 || e.score > max_score) {
        return jsonError(
          400,
          `score ${e.score} out of [0, ${max_score}] for student ${e.student_id}`,
          origin,
        );
      }
    }

    // Snapshot existing rows (for audit before_data).
    const { data: priorRows } = await admin
      .from("offline_test_scores")
      .select("id, student_id, score, max_score, notes")
      .eq("batch_id", batch_id)
      .eq("test_name", test_name)
      .eq("test_date", test_date)
      .in("student_id", studentIds);
    const priorByStu = new Map<
      string,
      { id: string; score: number; max_score: number; notes: string | null }
    >();
    for (const p of priorRows ?? []) {
      priorByStu.set(p.student_id, {
        id: p.id,
        score: Number(p.score),
        max_score: Number(p.max_score),
        notes: p.notes,
      });
    }

    // Upsert per the natural key.
    const upsertRows = entries.map((e) => ({
      batch_id,
      student_id: e.student_id,
      subject_id: subject_id ?? null,
      test_name,
      test_date,
      score: e.score,
      max_score,
      notes: e.notes ?? null,
      entered_by: caller.app_user_id,
    }));
    const { data: upserted, error: upErr } = await admin
      .from("offline_test_scores")
      .upsert(upsertRows, {
        onConflict: "batch_id,student_id,test_name,test_date",
      })
      .select("id, student_id, score, max_score, notes");
    if (upErr) {
      return jsonError(500, "upsert failed", origin, upErr.message);
    }

    let inserted_count = 0;
    let updated_count = 0;
    const audit_entries: Array<{
      student_id: string;
      before: { score: number; notes: string | null } | null;
      after: { score: number; notes: string | null };
    }> = [];
    for (const row of upserted ?? []) {
      const prior = priorByStu.get(row.student_id);
      if (!prior) inserted_count++;
      else updated_count++;
      audit_entries.push({
        student_id: row.student_id,
        before: prior ? { score: prior.score, notes: prior.notes } : null,
        after: { score: Number(row.score), notes: row.notes },
      });
    }

    await writeAudit(admin, {
      actor_user_id: caller.app_user_id,
      actor_role: callerIsAdmin ? adminRoleFor(caller) : "teacher",
      action: "offline_score_upsert",
      entity_table: "offline_test_scores",
      entity_id: null,
      before_data: {
        batch_id,
        test_name,
        test_date,
        subject_id: subject_id ?? null,
        max_score,
        prior_count: priorByStu.size,
      },
      after_data: {
        inserted_count,
        updated_count,
        entries: audit_entries,
      },
      ip_address: clientIp(req),
      user_agent: req.headers.get("user-agent"),
    });

    return json(
      200,
      {
        batch_id,
        test_name,
        test_date,
        inserted_count,
        updated_count,
        rows: upserted,
      },
      origin,
    );
  } catch (err) {
    if (err instanceof AuthError) {
      return jsonError(err.status, err.message, origin);
    }
    console.error("offline-score-upsert error:", err);
    return jsonError(500, "internal error", origin);
  }
});
