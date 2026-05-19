// Phase 7 CP5 — `exam-tab-switch` edge fn.
//
// Caller: authenticated student who owns the attempt. Input: `{ attempt_id }`.
//
// Fire-and-forget from the mobile client whenever AppState transitions
// `active → (inactive|background)`. Bumps `exam_attempts.tab_switch_count`
// by 1 and returns the new value so the client banner can display it.
//
// No auto-submit on switch (D-055). Server enforces nothing on this count —
// it's a teacher-visible signal only.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { handlePreflight } from "../_shared/cors.ts";
import { json, jsonError } from "../_shared/response.ts";
import { getServiceRoleClient } from "../_shared/supabase.ts";
import { AuthError, loadCaller, requireAnyRole } from "../_shared/auth.ts";
import { ExamTabSwitchInputSchema } from "../_shared/schemas.ts";

Deno.serve(async (req: Request) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  const origin = req.headers.get("Origin");

  if (req.method !== "POST") {
    return jsonError(405, "method not allowed", origin);
  }

  try {
    const caller = await loadCaller(req);
    requireAnyRole(caller, ["student"]);

    const rawBody = await req.json().catch(() => null);
    if (rawBody === null) return jsonError(400, "invalid JSON body", origin);
    const parsed = ExamTabSwitchInputSchema.safeParse(rawBody);
    if (!parsed.success) {
      return jsonError(400, "validation failed", origin, parsed.error.issues);
    }
    const { attempt_id } = parsed.data;

    const admin = getServiceRoleClient();

    // Verify ownership + that the attempt is still in-flight.
    const { data: attempt, error: attErr } = await admin
      .from("exam_attempts")
      .select("id, student_id, submitted_at, tab_switch_count")
      .eq("id", attempt_id)
      .maybeSingle();
    if (attErr) {
      return jsonError(500, "attempt lookup failed", origin, attErr.message);
    }
    if (!attempt) return jsonError(404, "attempt not found", origin);
    if (attempt.student_id !== caller.app_user_id) {
      return jsonError(403, "not your attempt", origin);
    }
    if (attempt.submitted_at !== null) {
      // Silently no-op on a submitted attempt — fire-and-forget after submit
      // should not error in the client UI.
      return json(200, { tab_switch_count: attempt.tab_switch_count }, origin);
    }

    const newCount = (attempt.tab_switch_count ?? 0) + 1;
    const { data: updated, error: updErr } = await admin
      .from("exam_attempts")
      .update({ tab_switch_count: newCount })
      .eq("id", attempt_id)
      .is("submitted_at", null)
      .select("tab_switch_count")
      .maybeSingle();
    if (updErr) {
      return jsonError(500, "tab-switch update failed", origin, updErr.message);
    }
    return json(
      200,
      { tab_switch_count: updated?.tab_switch_count ?? newCount },
      origin,
    );
  } catch (err) {
    if (err instanceof AuthError) {
      return jsonError(err.status, err.message, origin);
    }
    console.error("exam-tab-switch error:", err);
    return jsonError(500, "internal error", origin);
  }
});
