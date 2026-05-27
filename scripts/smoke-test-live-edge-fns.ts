// Phase 9 — Live edge-fn GATE smoke. Exercises auth / validation / role /
// assignment / status / kind-branch gates for all six fns WITHOUT a real
// YouTube broadcast (yt-broadcast-create lands on the 503 "not configured"
// path, which still proves every gate before the YT call passed).
//
//   yt-broadcast-create : 401 / 400 / 404 / 403(role) / 403(unassigned) / 503
//   yt-broadcast-golive : 403 / 404 / 200 (sets status=live)
//   yt-playback-sign    : live 200 / recording 409 / cross-batch 404 / 400
//   chat-delete         : 403 / 404 / 400 / 200 (soft-deletes)
//   chat-ban            : self 400 / 200 / idempotent 200 / 403 / unban 200
//   yt-broadcast-stop   : 403 / 200 (sets ended + system message)
//   yt-playback-sign    : recording 200 / live 409  (after stop)
//
// Run: pnpm smoke:live-fns

import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(__dirname, "..", "apps", "admin", ".env.local"), override: false });

const SUPABASE_URL = required("NEXT_PUBLIC_SUPABASE_URL");
const ANON_KEY = required("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const SERVICE_KEY = required("SUPABASE_SERVICE_ROLE_KEY");
const OWNER_EMAIL = process.env.OWNER_EMAIL ?? "owner@fynestudy.example.com";
const OWNER_PASSWORD = process.env.OWNER_INITIAL_PASSWORD ?? "FyneStudy01";
const RANDOM_UUID = "00000000-0000-4000-8000-000000000000";

function required(name: string): string {
  const v = process.env[name];
  if (!v) { console.error(`missing env var ${name}`); process.exit(1); }
  return v;
}
let passed = 0;
function header(s: string) { console.log(`\n=== ${s} ===`); }
function pass(s: string) { passed++; console.log(`  PASS  ${s}`); }
function fail(s: string): never { console.error(`  FAIL  ${s}`); process.exit(1); }
function expect(status: number, want: number, label: string, body?: unknown) {
  if (status !== want) fail(`${label}: expected ${want}, got ${status} ${JSON.stringify(body)}`);
  pass(`${label} → ${status}`);
}

async function signIn(email: string, password: string) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST", headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) fail(`signIn ${email}: ${res.status} ${JSON.stringify(data)}`);
  return data.access_token as string;
}
async function callFn(name: string, body: unknown, jwt: string | null) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (jwt) headers.Authorization = `Bearer ${jwt}`;
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: "POST", headers, body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: res.status, body: data };
}

interface Acct { user_id: string; auth_user_id: string; email: string; initial_password: string; }

async function main() {
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const ownerJwt = await signIn(OWNER_EMAIL, OWNER_PASSWORD);
  const ts = Date.now();

  header("Setup");
  const course = (await callFn("curriculum-mutate", { op: "create_course", payload: { code: `P9F_${ts}`, name: `P9 FN ${ts}` } }, ownerJwt)).body.row as { id: string };
  const today = new Date().toISOString().slice(0, 10);
  const batchA = ((await callFn("batch-mutate", { op: "create_batch", payload: { course_id: course.id, name: `P9F_A_${ts}`, starts_on: today, capacity: 10 } }, ownerJwt)).body.row as { id: string }).id;
  const batchB = ((await callFn("batch-mutate", { op: "create_batch", payload: { course_id: course.id, name: `P9F_B_${ts}`, starts_on: today, capacity: 10 } }, ownerJwt)).body.row as { id: string }).id;
  const teacher = (await callFn("auth-bootstrap", { role: "teacher", full_name: `P9F Teach ${ts}`, email: `p9f-teach-${ts}@fynestudy.example.com`, subjects: ["x"] }, ownerJwt)).body as Acct;
  const teacher2 = (await callFn("auth-bootstrap", { role: "teacher", full_name: `P9F Teach2 ${ts}`, email: `p9f-teach2-${ts}@fynestudy.example.com`, subjects: ["x"] }, ownerJwt)).body as Acct;
  await callFn("batch-mutate", { op: "assign_teacher", batch_id: batchA, teacher_id: teacher.user_id }, ownerJwt);
  const stuA = (await callFn("auth-bootstrap", { role: "student", full_name: `P9F A ${ts}`, email: `p9f-a-${ts}@fynestudy.example.com`, parent_consent_method: "verbal", batch_id: batchA }, ownerJwt)).body as Acct;
  const stuB = (await callFn("auth-bootstrap", { role: "student", full_name: `P9F B ${ts}`, email: `p9f-b-${ts}@fynestudy.example.com`, parent_consent_method: "verbal", batch_id: batchB }, ownerJwt)).body as Acct;
  await admin.from("app_users").update({ must_change_password: false }).in("id", [teacher.user_id, teacher2.user_id, stuA.user_id, stuB.user_id]);

  const sess = await admin.from("sessions").insert({
    batch_id: batchA, scheduled_start: new Date(Date.now() - 60_000).toISOString(),
    scheduled_end: new Date(Date.now() + 3_600_000).toISOString(),
    is_live_class: true, status: "scheduled", yt_video_id: "dQw4w9WgXcQ", created_by: teacher.user_id,
  }).select("id").single();
  if (sess.error || !sess.data) fail(`session insert: ${sess.error?.message}`);
  const sessionId = sess.data.id as string;

  const teachJwt = await signIn(teacher.email, teacher.initial_password);
  const teach2Jwt = await signIn(teacher2.email, teacher2.initial_password);
  const aJwt = await signIn(stuA.email, stuA.initial_password);
  const bJwt = await signIn(stuB.email, stuB.initial_password);
  pass("fixtures planted");

  header("yt-broadcast-create gates");
  expect((await callFn("yt-broadcast-create", { session_id: sessionId }, null)).status, 401, "no-auth");
  expect((await callFn("yt-broadcast-create", {}, teachJwt)).status, 400, "bad body");
  expect((await callFn("yt-broadcast-create", { session_id: RANDOM_UUID }, teachJwt)).status, 404, "unknown session");
  expect((await callFn("yt-broadcast-create", { session_id: sessionId }, aJwt)).status, 403, "student (role)");
  expect((await callFn("yt-broadcast-create", { session_id: sessionId }, teach2Jwt)).status, 403, "teacher not assigned");
  expect((await callFn("yt-broadcast-create", { session_id: sessionId }, teachJwt)).status, 503, "assigned teacher → YT not configured");

  header("yt-broadcast-golive gates");
  expect((await callFn("yt-broadcast-golive", { session_id: sessionId }, aJwt)).status, 403, "student (role)");
  expect((await callFn("yt-broadcast-golive", { session_id: RANDOM_UUID }, teachJwt)).status, 404, "unknown session");
  expect((await callFn("yt-broadcast-golive", { session_id: sessionId }, teachJwt)).status, 200, "assigned teacher go-live");
  const afterGolive = await admin.from("sessions").select("status").eq("id", sessionId).single();
  if (afterGolive.data?.status !== "live") fail(`session not live after golive: ${JSON.stringify(afterGolive.data)}`);
  pass("session.status = 'live' after golive");

  header("yt-playback-sign kind/status/scope gates (live)");
  expect((await callFn("yt-playback-sign", {}, aJwt)).status, 400, "bad body");
  expect((await callFn("yt-playback-sign", { session_id: sessionId, kind: "live" }, aJwt)).status, 200, "student live sign");
  expect((await callFn("yt-playback-sign", { session_id: sessionId, kind: "recording" }, aJwt)).status, 409, "recording before end → 409");
  expect((await callFn("yt-playback-sign", { session_id: sessionId, kind: "live" }, bJwt)).status, 404, "cross-batch → 404");

  header("chat-delete gates");
  const seeded = await admin.from("chat_messages").insert({ session_id: sessionId, author_id: stuA.user_id, body: "delete me", kind: "chat" }).select("id").single();
  const msgId = seeded.data!.id as string;
  expect((await callFn("chat-delete", {}, teachJwt)).status, 400, "bad body");
  expect((await callFn("chat-delete", { message_id: RANDOM_UUID }, teachJwt)).status, 404, "unknown message");
  expect((await callFn("chat-delete", { message_id: msgId }, aJwt)).status, 403, "student (role)");
  expect((await callFn("chat-delete", { message_id: msgId }, teachJwt)).status, 200, "teacher delete");
  const delChk = await admin.from("chat_messages").select("is_deleted").eq("id", msgId).single();
  if (delChk.data?.is_deleted !== true) fail("message not soft-deleted");
  pass("message soft-deleted (is_deleted=true)");

  header("chat-ban gates");
  expect((await callFn("chat-ban", { session_id: sessionId, user_id: teacher.user_id }, teachJwt)).status, 400, "self-ban rejected");
  expect((await callFn("chat-ban", { session_id: sessionId, user_id: stuA.user_id }, aJwt)).status, 403, "student cannot ban");
  expect((await callFn("chat-ban", { session_id: sessionId, user_id: stuA.user_id }, teachJwt)).status, 200, "teacher ban");
  expect((await callFn("chat-ban", { session_id: sessionId, user_id: stuA.user_id }, teachJwt)).status, 200, "ban idempotent");
  const banChk = await admin.from("chat_bans").select("user_id").eq("session_id", sessionId).eq("user_id", stuA.user_id).maybeSingle();
  if (!banChk.data) fail("ban row not present");
  pass("ban row present");
  expect((await callFn("chat-ban", { session_id: sessionId, user_id: stuA.user_id, action: "unban" }, teachJwt)).status, 200, "teacher unban");
  const unbanChk = await admin.from("chat_bans").select("user_id").eq("session_id", sessionId).eq("user_id", stuA.user_id).maybeSingle();
  if (unbanChk.data) fail("ban row still present after unban");
  pass("ban row removed after unban");

  header("yt-broadcast-stop gates");
  expect((await callFn("yt-broadcast-stop", { session_id: sessionId }, aJwt)).status, 403, "student (role)");
  expect((await callFn("yt-broadcast-stop", { session_id: sessionId }, teachJwt)).status, 200, "teacher stop");
  const afterStop = await admin.from("sessions").select("status").eq("id", sessionId).single();
  if (afterStop.data?.status !== "ended") fail(`session not ended after stop: ${JSON.stringify(afterStop.data)}`);
  pass("session.status = 'ended' after stop");
  const sysMsg = await admin.from("chat_messages").select("id").eq("session_id", sessionId).eq("kind", "system");
  if ((sysMsg.data ?? []).length < 1) fail("no system end-of-class message inserted");
  pass("system end-of-class message present");

  header("yt-playback-sign after stop (recording)");
  expect((await callFn("yt-playback-sign", { session_id: sessionId, kind: "recording" }, aJwt)).status, 200, "recording after end → 200");
  expect((await callFn("yt-playback-sign", { session_id: sessionId, kind: "live" }, aJwt)).status, 409, "live after end → 409");

  header("Cleanup");
  await admin.from("chat_bans").delete().eq("session_id", sessionId);
  await admin.from("raise_hand_events").delete().eq("session_id", sessionId);
  await admin.from("chat_messages").delete().eq("session_id", sessionId);
  await admin.from("sessions").delete().eq("id", sessionId);
  const ids = [teacher.user_id, teacher2.user_id, stuA.user_id, stuB.user_id];
  for (const u of ids) {
    await admin.from("batch_teachers").delete().eq("teacher_id", u);
    await admin.from("students").delete().eq("user_id", u);
    await admin.from("teachers").delete().eq("user_id", u);
    await admin.from("user_roles").delete().eq("user_id", u);
    await admin.from("audit_log").delete().eq("actor_user_id", u);
    await admin.from("app_users").delete().eq("id", u);
  }
  for (const a of [teacher, teacher2, stuA, stuB]) {
    try { await admin.auth.admin.deleteUser(a.auth_user_id); } catch { /* ignore */ }
  }
  await admin.from("batches").delete().in("id", [batchA, batchB]);
  await admin.from("courses").delete().eq("id", course.id);
  pass("cleanup done");

  console.log(`\nALL LIVE EDGE-FN SMOKES PASSED (${passed} checks).`);
}

main().catch((e) => { console.error(e); process.exit(1); });
