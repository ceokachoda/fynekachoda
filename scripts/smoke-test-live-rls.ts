// Phase 9 — Live-class RLS smoke. Verifies:
//
//   T1  Student of batch A can read the session's chat.
//   T2  Student of batch B CANNOT read batch A's chat (cross-batch isolation).
//   T3  Student of batch A can post 5 chat messages...
//   T4  ...and the 6th within 30s is blocked by the rate-limit trigger.
//   T5  A banned student can READ chat but CANNOT post (cm_insert + chat_bans).
//   T6  yt-playback-sign(live): in-batch student gets 200; cross-batch gets 404.
//   T7  Raise-hand: in-batch student can raise; cross-batch cannot; teacher sees the queue, cross-batch student does not.
//
// Provisions an ephemeral course + 2 batches + 1 teacher + 3 students via edge
// fns, plants a live session + a seeded chat message via service role, and
// cleans everything up. Run: pnpm smoke:live-rls

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

function required(name: string): string {
  const v = process.env[name];
  if (!v) { console.error(`missing env var ${name}`); process.exit(1); }
  return v;
}
let passed = 0;
function header(s: string) { console.log(`\n=== ${s} ===`); }
function pass(s: string) { passed++; console.log(`  PASS  ${s}`); }
function fail(s: string): never { console.error(`  FAIL  ${s}`); process.exit(1); }

async function signIn(email: string, password: string) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST", headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) fail(`signIn ${email}: ${res.status} ${JSON.stringify(data)}`);
  return data.access_token as string;
}
async function callFn(name: string, body: unknown, jwt: string) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: res.status, body: data };
}
async function rest<T = unknown>(method: "GET" | "POST", path: string, jwt: string, body?: unknown) {
  const headers: Record<string, string> = { apikey: ANON_KEY, "Content-Type": "application/json" };
  headers.Authorization = `Bearer ${jwt}`;
  if (method === "POST") headers["Prefer"] = "return=representation";
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method, headers, body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let parsed: unknown;
  try { parsed = text.length ? JSON.parse(text) : null; } catch { parsed = text; }
  return { status: res.status, body: parsed as T };
}

interface Acct { user_id: string; auth_user_id: string; email: string; initial_password: string; }

async function main() {
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const ownerJwt = await signIn(OWNER_EMAIL, OWNER_PASSWORD);
  const ts = Date.now();

  header("Setup — course / 2 batches / teacher / 3 students");
  const course = (await callFn("curriculum-mutate", { op: "create_course", payload: { code: `P9R_${ts}`, name: `P9 RLS ${ts}` } }, ownerJwt)).body.row as { id: string };
  const today = new Date().toISOString().slice(0, 10);
  const batchA = ((await callFn("batch-mutate", { op: "create_batch", payload: { course_id: course.id, name: `P9R_A_${ts}`, starts_on: today, capacity: 10 } }, ownerJwt)).body.row as { id: string }).id;
  const batchB = ((await callFn("batch-mutate", { op: "create_batch", payload: { course_id: course.id, name: `P9R_B_${ts}`, starts_on: today, capacity: 10 } }, ownerJwt)).body.row as { id: string }).id;
  const teacher = (await callFn("auth-bootstrap", { role: "teacher", full_name: `P9R Teach ${ts}`, email: `p9r-teach-${ts}@fynestudy.example.com`, subjects: ["x"] }, ownerJwt)).body as Acct;
  await callFn("batch-mutate", { op: "assign_teacher", batch_id: batchA, teacher_id: teacher.user_id }, ownerJwt);
  const a1 = (await callFn("auth-bootstrap", { role: "student", full_name: `P9R A1 ${ts}`, email: `p9r-a1-${ts}@fynestudy.example.com`, parent_consent_method: "verbal", batch_id: batchA }, ownerJwt)).body as Acct;
  const a2 = (await callFn("auth-bootstrap", { role: "student", full_name: `P9R A2 ${ts}`, email: `p9r-a2-${ts}@fynestudy.example.com`, parent_consent_method: "verbal", batch_id: batchA }, ownerJwt)).body as Acct;
  const b1 = (await callFn("auth-bootstrap", { role: "student", full_name: `P9R B1 ${ts}`, email: `p9r-b1-${ts}@fynestudy.example.com`, parent_consent_method: "verbal", batch_id: batchB }, ownerJwt)).body as Acct;
  await admin.from("app_users").update({ must_change_password: false }).in("id", [teacher.user_id, a1.user_id, a2.user_id, b1.user_id]);

  // Live session in batch A + a seeded chat message authored by A2 (so it does
  // not count toward A1's rate-limit window).
  const sess = await admin.from("sessions").insert({
    batch_id: batchA, scheduled_start: new Date(Date.now() - 60_000).toISOString(),
    scheduled_end: new Date(Date.now() + 3_600_000).toISOString(),
    is_live_class: true, status: "live", started_at: new Date(Date.now() - 30_000).toISOString(),
    yt_video_id: "dQw4w9WgXcQ", created_by: teacher.user_id,
  }).select("id").single();
  if (sess.error || !sess.data) fail(`session insert: ${sess.error?.message}`);
  const sessionId = sess.data.id as string;
  await admin.from("chat_messages").insert({ session_id: sessionId, author_id: a2.user_id, body: "seeded message", kind: "chat" });

  const teachJwt = await signIn(teacher.email, teacher.initial_password);
  const a1Jwt = await signIn(a1.email, a1.initial_password);
  const a2Jwt = await signIn(a2.email, a2.initial_password);
  const b1Jwt = await signIn(b1.email, b1.initial_password);
  pass("fixtures planted");

  header("T1 — student A1 can read the session chat");
  const t1 = await rest<unknown[]>("GET", `chat_messages?session_id=eq.${sessionId}&select=id`, a1Jwt);
  if (t1.status !== 200 || (t1.body ?? []).length < 1) fail(`A1 read: ${t1.status} ${JSON.stringify(t1.body)}`);
  pass(`A1 sees ${(t1.body ?? []).length} message(s)`);

  header("T2 — student B1 (other batch) CANNOT read the chat");
  const t2 = await rest<unknown[]>("GET", `chat_messages?session_id=eq.${sessionId}&select=id`, b1Jwt);
  if (t2.status !== 200 || (t2.body ?? []).length !== 0) fail(`B1 leaked: ${t2.status} ${JSON.stringify(t2.body)}`);
  pass("cross-batch chat hidden from B1");

  header("T3/T4 — A1 posts 5 messages, 6th is rate-limited");
  for (let i = 1; i <= 5; i++) {
    const r = await rest("POST", "chat_messages", a1Jwt, { session_id: sessionId, author_id: a1.user_id, body: `msg ${i}`, kind: "chat" });
    if (r.status >= 400) fail(`A1 message ${i} should succeed, got ${r.status} ${JSON.stringify(r.body)}`);
  }
  pass("A1 posted 5 messages within the window");
  const sixth = await rest("POST", "chat_messages", a1Jwt, { session_id: sessionId, author_id: a1.user_id, body: "msg 6 too fast", kind: "chat" });
  if (sixth.status < 400) fail(`6th message should be rate-limited, got ${sixth.status} ${JSON.stringify(sixth.body)}`);
  pass(`6th message blocked by rate-limit trigger (status ${sixth.status})`);

  header("T5 — banned student can READ but CANNOT post");
  await admin.from("chat_bans").insert({ session_id: sessionId, user_id: a2.user_id, banned_by: teacher.user_id });
  const a2Read = await rest<unknown[]>("GET", `chat_messages?session_id=eq.${sessionId}&select=id`, a2Jwt);
  if (a2Read.status !== 200 || (a2Read.body ?? []).length < 1) fail(`banned A2 read: ${a2Read.status}`);
  pass("banned A2 can still read chat");
  const a2Post = await rest("POST", "chat_messages", a2Jwt, { session_id: sessionId, author_id: a2.user_id, body: "should be blocked", kind: "chat" });
  if (a2Post.status < 400) fail(`banned A2 post should be blocked, got ${a2Post.status} ${JSON.stringify(a2Post.body)}`);
  pass(`banned A2 post blocked (status ${a2Post.status})`);

  header("T6 — yt-playback-sign(live): in-batch 200, cross-batch 404");
  const signA1 = await callFn("yt-playback-sign", { session_id: sessionId, kind: "live" }, a1Jwt);
  if (signA1.status !== 200 || !signA1.body.envelope) fail(`A1 sign: ${signA1.status} ${JSON.stringify(signA1.body)}`);
  if (signA1.body.video_id !== "dQw4w9WgXcQ") fail(`A1 sign wrong video_id: ${JSON.stringify(signA1.body)}`);
  pass("A1 got a signed live playback envelope");
  const signB1 = await callFn("yt-playback-sign", { session_id: sessionId, kind: "live" }, b1Jwt);
  if (signB1.status !== 404) fail(`B1 sign should be 404, got ${signB1.status} ${JSON.stringify(signB1.body)}`);
  pass("cross-batch B1 cannot get a playback token (404)");

  header("T7 — raise-hand isolation");
  const rhA1 = await rest("POST", "raise_hand_events", a1Jwt, { session_id: sessionId, student_id: a1.user_id });
  if (rhA1.status >= 400) fail(`A1 raise hand should succeed, got ${rhA1.status} ${JSON.stringify(rhA1.body)}`);
  pass("A1 raised hand");
  const rhB1 = await rest("POST", "raise_hand_events", b1Jwt, { session_id: sessionId, student_id: b1.user_id });
  if (rhB1.status < 400) fail(`B1 raise hand should be blocked, got ${rhB1.status} ${JSON.stringify(rhB1.body)}`);
  pass(`B1 cannot raise hand in another batch's session (status ${rhB1.status})`);
  const tRead = await rest<unknown[]>("GET", `raise_hand_events?session_id=eq.${sessionId}&select=id`, teachJwt);
  if (tRead.status !== 200 || (tRead.body ?? []).length < 1) fail(`teacher read hands: ${tRead.status} ${JSON.stringify(tRead.body)}`);
  pass(`teacher sees ${(tRead.body ?? []).length} raised hand(s)`);
  const bReadHands = await rest<unknown[]>("GET", `raise_hand_events?session_id=eq.${sessionId}&select=id`, b1Jwt);
  if (bReadHands.status !== 200 || (bReadHands.body ?? []).length !== 0) fail(`B1 leaked hands: ${JSON.stringify(bReadHands.body)}`);
  pass("cross-batch student cannot see the hand queue");

  header("Cleanup");
  await admin.from("chat_bans").delete().eq("session_id", sessionId);
  await admin.from("raise_hand_events").delete().eq("session_id", sessionId);
  await admin.from("chat_messages").delete().eq("session_id", sessionId);
  await admin.from("sessions").delete().eq("id", sessionId);
  const ids = [teacher.user_id, a1.user_id, a2.user_id, b1.user_id];
  for (const u of ids) {
    await admin.from("batch_teachers").delete().eq("teacher_id", u);
    await admin.from("students").delete().eq("user_id", u);
    await admin.from("teachers").delete().eq("user_id", u);
    await admin.from("user_roles").delete().eq("user_id", u);
    await admin.from("audit_log").delete().eq("actor_user_id", u);
    await admin.from("app_users").delete().eq("id", u);
  }
  for (const a of [teacher, a1, a2, b1]) {
    try { await admin.auth.admin.deleteUser(a.auth_user_id); } catch { /* ignore */ }
  }
  await admin.from("batches").delete().in("id", [batchA, batchB]);
  await admin.from("courses").delete().eq("id", course.id);
  pass("cleanup done");

  console.log(`\nALL LIVE RLS SMOKES PASSED (${passed} checks).`);
}

main().catch((e) => { console.error(e); process.exit(1); });
