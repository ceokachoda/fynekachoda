// Recipient resolution + Expo (mobile) & Web Push (PWA) senders.
//
// Imported ONLY by `push-dispatch`, so the heavy Web Push crypto path loads in
// exactly one function. `web-push` itself is loaded via a DYNAMIC import inside
// the web sender, so an Expo-only push never pays its cost and a (hypothetical)
// web-push load failure can never take down the Expo path.

import type { SupabaseClient } from "npm:@supabase/supabase-js@2.45.0";
import { getVaultSecret } from "./vault.ts";

export interface Audience {
  batch_id?: string | null;
  course_id?: string | null;
  user_ids?: string[] | null;
}

export interface PushNotification {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export interface SendResult {
  sent: number;
  failed: number;
}

// Resolve an audience to a de-duped list of ACTIVE student app_user ids.
// Suspended accounts (is_active=false) are dropped — they must never receive
// pushes (mirrors the edge-fn active-flag hard rule).
export async function resolveStudentUserIds(
  admin: SupabaseClient,
  audience: Audience,
): Promise<string[]> {
  let userIds: string[] = [];

  if (audience.user_ids && audience.user_ids.length > 0) {
    userIds = audience.user_ids;
  } else if (audience.batch_id) {
    const { data, error } = await admin
      .from("students")
      .select("user_id")
      .eq("batch_id", audience.batch_id);
    if (error) throw new Error(`students-by-batch failed: ${error.message}`);
    userIds = (data ?? []).map((r) => r.user_id as string);
  } else if (audience.course_id) {
    // Course-wide: every student whose batch belongs to the course.
    const { data, error } = await admin
      .from("students")
      .select("user_id, batches!inner(course_id)")
      .eq("batches.course_id", audience.course_id);
    if (error) throw new Error(`students-by-course failed: ${error.message}`);
    userIds = (data ?? []).map((r) => r.user_id as string);
  }

  if (userIds.length === 0) return [];

  const unique = Array.from(new Set(userIds));
  const { data: active, error: aErr } = await admin
    .from("app_users")
    .select("id")
    .in("id", unique)
    .eq("is_active", true);
  if (aErr) throw new Error(`active-filter failed: ${aErr.message}`);
  return (active ?? []).map((r) => r.id as string);
}

// --- Expo (mobile) ----------------------------------------------------------
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

interface ExpoRow {
  id: string;
  expo_push_token: string;
}

export async function sendExpo(
  admin: SupabaseClient,
  userIds: string[],
  note: PushNotification,
): Promise<SendResult> {
  if (userIds.length === 0) return { sent: 0, failed: 0 };
  const { data: rows, error } = await admin
    .from("device_push_tokens")
    .select("id, expo_push_token")
    .in("user_id", userIds)
    .eq("is_active", true);
  if (error) throw new Error(`expo token fetch failed: ${error.message}`);
  const tokens = (rows ?? []) as ExpoRow[];
  if (tokens.length === 0) return { sent: 0, failed: 0 };

  let sent = 0;
  let failed = 0;
  const deadIds: string[] = [];

  // Expo accepts up to 100 messages per request.
  for (let i = 0; i < tokens.length; i += 100) {
    const slice = tokens.slice(i, i + 100);
    const messages = slice.map((t) => ({
      to: t.expo_push_token,
      title: note.title,
      body: note.body,
      data: note.data ?? {},
      sound: "default",
      priority: "high",
      channelId: "default",
    }));
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify(messages),
      });
      const payload = await res.json().catch(() => null);
      const tickets = payload?.data;
      if (Array.isArray(tickets)) {
        tickets.forEach((tk: { status?: string; details?: { error?: string } }, idx: number) => {
          if (tk?.status === "ok") {
            sent++;
          } else {
            failed++;
            if (tk?.details?.error === "DeviceNotRegistered") {
              deadIds.push(slice[idx].id);
            }
          }
        });
      } else {
        failed += slice.length;
        console.error("expo push: unexpected response", JSON.stringify(payload));
      }
    } catch (e) {
      failed += slice.length;
      console.error("expo push chunk failed:", e instanceof Error ? e.message : e);
    }
  }

  if (deadIds.length > 0) {
    await admin
      .from("device_push_tokens")
      .update({ is_active: false })
      .in("id", deadIds);
  }
  return { sent, failed };
}

// --- Web Push (PWA) ---------------------------------------------------------
interface WebRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

// deno-lint-ignore no-explicit-any
let webpushMod: any = null;
let vapidReady = false;

async function getWebpush(): Promise<unknown | null> {
  if (webpushMod) return webpushMod;
  try {
    const mod = await import("npm:web-push@3.6.7");
    // deno-lint-ignore no-explicit-any
    webpushMod = (mod as any).default ?? mod;
    return webpushMod;
  } catch (e) {
    console.error("web-push import failed:", e instanceof Error ? e.message : e);
    return null;
  }
}

async function ensureVapid(): Promise<unknown | null> {
  const wp = await getWebpush();
  if (!wp) return null;
  if (vapidReady) return wp;
  const pub = await getVaultSecret("VAPID_PUBLIC_KEY");
  const priv = await getVaultSecret("VAPID_PRIVATE_KEY");
  const subject = (await getVaultSecret("VAPID_SUBJECT")) ??
    "mailto:support@fynestudy.live";
  if (!pub || !priv) {
    console.error("VAPID keys missing in vault; skipping web push");
    return null;
  }
  // deno-lint-ignore no-explicit-any
  (wp as any).setVapidDetails(subject, pub, priv);
  vapidReady = true;
  return wp;
}

export async function sendWeb(
  admin: SupabaseClient,
  userIds: string[],
  note: PushNotification,
): Promise<SendResult> {
  if (userIds.length === 0) return { sent: 0, failed: 0 };
  const { data: rows, error } = await admin
    .from("web_push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("user_id", userIds)
    .eq("is_active", true);
  if (error) throw new Error(`web sub fetch failed: ${error.message}`);
  const subs = (rows ?? []) as WebRow[];
  if (subs.length === 0) return { sent: 0, failed: 0 };

  const wp = await ensureVapid();
  if (!wp) return { sent: 0, failed: subs.length };

  const payload = JSON.stringify({
    title: note.title,
    body: note.body,
    data: note.data ?? {},
  });

  let sent = 0;
  let failed = 0;
  const deadIds: string[] = [];

  await Promise.all(
    subs.map(async (s) => {
      try {
        // deno-lint-ignore no-explicit-any
        await (wp as any).sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
          { TTL: 600 },
        );
        sent++;
      } catch (e) {
        failed++;
        const code = (e as { statusCode?: number })?.statusCode;
        // 404/410 => subscription is gone; deactivate so we stop trying.
        if (code === 404 || code === 410) {
          deadIds.push(s.id);
        } else {
          console.error(
            "web push failed:",
            code,
            e instanceof Error ? e.message : e,
          );
        }
      }
    }),
  );

  if (deadIds.length > 0) {
    await admin
      .from("web_push_subscriptions")
      .update({ is_active: false })
      .in("id", deadIds);
  }
  return { sent, failed };
}
