// `push-class-reminders` — "class starting soon" nudge.
//
// Invoked once a minute by the `push-class-reminders` pg_cron job (via pg_net,
// through `private.dispatch_class_reminders()`). verify_jwt is DISABLED; the
// gate is the `X-Cron-Secret` header (== the PUSH_CRON_SECRET vault value).
//
// Scans for sessions that are scheduled, start within the next ~11 minutes, and
// have not been reminded yet. Each session is CLAIMED atomically
// (reminder_sent_at: null -> now()) so overlapping runs never double-send, then
// the batch's students get a push (fanned out through push-dispatch).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, jsonError } from "../_shared/response.ts";
import { getServiceRoleClient } from "../_shared/supabase.ts";
import { getVaultSecret } from "../_shared/vault.ts";
import { notifyStudents } from "../_shared/notify.ts";

const WINDOW_MINUTES = 11;

interface SessionRow {
  id: string;
  batch_id: string;
  title: string | null;
  is_live_class: boolean;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return jsonError(405, "method not allowed", null);

  const secret = req.headers.get("X-Cron-Secret");
  const expected = await getVaultSecret("PUSH_CRON_SECRET");
  if (!expected || secret !== expected) {
    return jsonError(401, "unauthorized", null);
  }

  try {
    const admin = getServiceRoleClient();
    const nowIso = new Date().toISOString();
    const windowIso = new Date(Date.now() + WINDOW_MINUTES * 60_000).toISOString();

    const { data: candidates, error } = await admin
      .from("sessions")
      .select("id, batch_id, title, is_live_class")
      .eq("status", "scheduled")
      .is("reminder_sent_at", null)
      .gt("scheduled_start", nowIso)
      .lte("scheduled_start", windowIso);
    if (error) return jsonError(500, "session scan failed", null, error.message);

    let reminded = 0;
    for (const s of (candidates ?? []) as SessionRow[]) {
      // Claim atomically — only the run that flips null->now() sends.
      const { data: claimed } = await admin
        .from("sessions")
        .update({ reminder_sent_at: new Date().toISOString() })
        .eq("id", s.id)
        .is("reminder_sent_at", null)
        .select("id")
        .maybeSingle();
      if (!claimed) continue;

      const name = s.title ?? "Your class";
      notifyStudents(
        { batch_id: s.batch_id },
        {
          title: "Class starting soon",
          body: `${name} starts in about 10 minutes. Tap to get ready.`,
          data: { type: "class_reminder", session_id: s.id },
        },
      );
      reminded++;
    }

    return json(200, { ok: true, scanned: candidates?.length ?? 0, reminded }, null);
  } catch (err) {
    console.error("push-class-reminders error:", err);
    return jsonError(500, "internal error", null);
  }
});
