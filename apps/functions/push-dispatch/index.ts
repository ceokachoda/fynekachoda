// `push-dispatch` — internal notification sender.
//
// Resolves an audience (batch / course / explicit user ids) to ACTIVE student
// accounts and sends both Expo (mobile) and Web Push (PWA). Called
// server-to-server by the event edge fns + push-class-reminders via
// `_shared/notify.ts`. There is NO user JWT here — verify_jwt is DISABLED and
// the gate is the `X-Internal-Key` header (== the project service-role key,
// which only trusted server code holds).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { handlePreflight } from "../_shared/cors.ts";
import { json, jsonError } from "../_shared/response.ts";
import { getServiceRoleClient } from "../_shared/supabase.ts";
import {
  type Audience,
  type PushNotification,
  resolveStudentUserIds,
  sendExpo,
  sendWeb,
} from "../_shared/push.ts";

Deno.serve(async (req: Request) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  const origin = req.headers.get("Origin");
  if (req.method !== "POST") return jsonError(405, "method not allowed", origin);

  const internalKey = req.headers.get("X-Internal-Key");
  const expected = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!expected || internalKey !== expected) {
    return jsonError(401, "unauthorized", origin);
  }

  try {
    const body = (await req.json().catch(() => null)) as {
      audience?: Audience;
      notification?: PushNotification;
    } | null;
    if (!body) return jsonError(400, "invalid JSON body", origin);

    const audience = body.audience ?? {};
    const note = body.notification;
    if (
      !note || typeof note.title !== "string" || typeof note.body !== "string"
    ) {
      return jsonError(400, "notification.title and .body are required", origin);
    }

    const admin = getServiceRoleClient();
    const userIds = await resolveStudentUserIds(admin, audience);
    if (userIds.length === 0) {
      return json(
        200,
        { ok: true, recipients: 0, expo: { sent: 0, failed: 0 }, web: { sent: 0, failed: 0 } },
        origin,
      );
    }

    // Run both channels in parallel; one failing never affects the other.
    const [expo, web] = await Promise.all([
      sendExpo(admin, userIds, note).catch((e) => {
        console.error("sendExpo failed:", e instanceof Error ? e.message : e);
        return { sent: 0, failed: 0 };
      }),
      sendWeb(admin, userIds, note).catch((e) => {
        console.error("sendWeb failed:", e instanceof Error ? e.message : e);
        return { sent: 0, failed: 0 };
      }),
    ]);

    return json(200, { ok: true, recipients: userIds.length, expo, web }, origin);
  } catch (err) {
    console.error("push-dispatch error:", err);
    return jsonError(500, "internal error", origin);
  }
});
