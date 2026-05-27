// Phase 9 — Manual-test fixtures for live classes.
//
// The whole live + recording experience is testable WITHOUT a real YouTube
// broadcast or OBS, because we seed sessions that already carry a REAL public
// educational `yt_video_id` (so yt-playback-sign + the wrapped player work) plus
// pre-built chat + raise-hand history:
//
//   LIVE NOW   — status='live', is_live_class, real video. Open it as a student
//                to see the wrapped player + live chat + raise-hand; open
//                live-control as the teacher to moderate / pin / end. Two
//                students can chat in real time.
//   UPCOMING   — status='scheduled', starts in ~12 min => student lobby
//                countdown; teacher "Go Live".
//   RECORDING  — status='ended', real video + ~8 chat messages with realistic
//                posted_at offsets + 2 (resolved) raised hands => the recording
//                screen replays chat in sync as the video plays.
//
// Run:
//   pnpm seed:live-manual-test           # fresh fixtures
//   pnpm seed:live-manual-test --reset   # wipe prior p9-* fixtures first
//
// NOTE: DEMO_VIDEO_ID must be a PUBLIC, EMBEDDABLE YouTube video. If it shows
// "Video unavailable" in your region, change it to any public video id and
// re-run with --reset.

import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(__dirname, "..", "apps", "admin", ".env.local"), override: false });

const SUPABASE_URL = required("NEXT_PUBLIC_SUPABASE_URL");
const ANON_KEY = required("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const SERVICE_KEY = required("SUPABASE_SERVICE_ROLE_KEY");
const OWNER_EMAIL = process.env.OWNER_EMAIL ?? "owner@fynestudy.example.com";
const OWNER_PASSWORD = process.env.OWNER_INITIAL_PASSWORD ?? "FyneStudy01";
const RESET = process.argv.includes("--reset");

// 3Blue1Brown — "The Essence of Calculus, chapter 1" (public + embeddable).
const DEMO_VIDEO_ID = "WUvTyaaNkzM";

function required(name: string): string {
  const v = process.env[name];
  if (!v) { console.error(`missing env var ${name}`); process.exit(1); }
  return v;
}
function h(s: string) { console.log(`\n== ${s} ==`); }
function info(s: string) { console.log(`   ${s}`); }
function die(s: string): never { console.error(`FAIL ${s}`); process.exit(1); }

async function signIn(email: string, password: string) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST", headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) die(`signIn ${email}: ${res.status} ${JSON.stringify(data)}`);
  return data.access_token as string;
}
async function callFn(name: string, body: unknown, jwt: string, allow: number[] = []) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: "POST", headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status !== 200 && !allow.includes(res.status)) die(`callFn ${name}: ${res.status} ${JSON.stringify(data)}`);
  return { status: res.status, data: data as Record<string, unknown> };
}

interface Acct { user_id: string; auth_user_id: string; email: string; initial_password: string; }

async function resetPriorFixtures(admin: SupabaseClient) {
  h("Reset — wiping prior `p9-*` fixtures");
  const oldCourses = await admin.from("courses").select("id").like("code", "P9_TEST_%");
  const oldCourseIds = (oldCourses.data ?? []).map((r: { id: string }) => r.id);
  if (oldCourseIds.length > 0) {
    const oldBatches = await admin.from("batches").select("id").in("course_id", oldCourseIds);
    const bIds = (oldBatches.data ?? []).map((r: { id: string }) => r.id);
    if (bIds.length > 0) {
      const sess = await admin.from("sessions").select("id").in("batch_id", bIds);
      const sIds = (sess.data ?? []).map((r: { id: string }) => r.id);
      if (sIds.length > 0) {
        await admin.from("chat_bans").delete().in("session_id", sIds);
        await admin.from("raise_hand_events").delete().in("session_id", sIds);
        await admin.from("chat_messages").delete().in("session_id", sIds);
        await admin.from("attendance").delete().in("session_id", sIds);
        await admin.from("sessions").delete().in("id", sIds);
      }
      await admin.from("batches").delete().in("id", bIds);
    }
  }
  const stale = await admin.from("app_users").select("id, auth_user_id").like("email", "p9-%").limit(500);
  const ids = (stale.data ?? []).map((r) => r.id as string);
  const authIds = (stale.data ?? []).map((r) => r.auth_user_id as string);
  for (const u of ids) {
    await admin.from("batch_teachers").delete().eq("teacher_id", u);
    await admin.from("students").delete().eq("user_id", u);
    await admin.from("teachers").delete().eq("user_id", u);
    await admin.from("user_roles").delete().eq("user_id", u);
    await admin.from("audit_log").delete().eq("actor_user_id", u);
  }
  if (oldCourseIds.length > 0) await admin.from("courses").delete().in("id", oldCourseIds);
  let deleted = 0;
  for (let i = 0; i < ids.length; i++) {
    const { error } = await admin.from("app_users").delete().eq("id", ids[i]!);
    if (error) continue;
    try { await admin.auth.admin.deleteUser(authIds[i]!); } catch { /* ignore */ }
    deleted++;
  }
  info(`deleted ${oldCourseIds.length} prior P9_TEST_* courses + ${deleted}/${ids.length} p9-* users`);
}

async function main() {
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  const ownerJwt = await signIn(OWNER_EMAIL, OWNER_PASSWORD);
  if (RESET) await resetPriorFixtures(admin);

  const ts = Date.now();
  const courseCode = `P9_TEST_${ts}`;

  h("Curriculum + batch + teacher + 2 students");
  const course = (await callFn("curriculum-mutate", { op: "create_course", payload: { code: courseCode, name: `Phase 9 Live ${ts}` } }, ownerJwt)).data.row as { id: string };
  const subject = (await callFn("curriculum-mutate", { op: "create_subject", payload: { course_id: course.id, name: "Physics", sort_order: 0 } }, ownerJwt)).data.row as { id: string };
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const batch = (await callFn("batch-mutate", { op: "create_batch", payload: { course_id: course.id, name: `P9_A_${ts}`, starts_on: today, capacity: 30 } }, ownerJwt)).data.row as { id: string };
  const teacher = (await callFn("auth-bootstrap", { role: "teacher", full_name: `P9 Teacher ${ts}`, email: `p9-teach-${ts}@fynestudy.example.com`, subjects: ["physics"] }, ownerJwt)).data as Acct;
  await callFn("batch-mutate", { op: "assign_teacher", batch_id: batch.id, teacher_id: teacher.user_id }, ownerJwt);
  const s1 = (await callFn("auth-bootstrap", { role: "student", full_name: `P9 Student One ${ts}`, email: `p9-s1-${ts}@fynestudy.example.com`, parent_consent_method: "verbal", batch_id: batch.id }, ownerJwt)).data as Acct;
  const s2 = (await callFn("auth-bootstrap", { role: "student", full_name: `P9 Student Two ${ts}`, email: `p9-s2-${ts}@fynestudy.example.com`, parent_consent_method: "verbal", batch_id: batch.id }, ownerJwt)).data as Acct;
  await admin.from("app_users").update({ must_change_password: false }).in("id", [teacher.user_id, s1.user_id, s2.user_id]);

  const mkSession = async (status: string, startMsAgo: number, durMin: number, withVideo: boolean, endedMsAgo?: number) => {
    const start = new Date(Date.now() - startMsAgo);
    const row: Record<string, unknown> = {
      batch_id: batch.id, subject_id: subject.id,
      scheduled_start: start.toISOString(),
      scheduled_end: new Date(start.getTime() + durMin * 60000).toISOString(),
      is_live_class: true, status,
      created_by: teacher.user_id,
    };
    if (withVideo) row.yt_video_id = DEMO_VIDEO_ID;
    if (status === "live" || status === "ended") row.started_at = start.toISOString();
    if (status === "ended") row.ended_at = new Date(Date.now() - (endedMsAgo ?? 0)).toISOString();
    const ins = await admin.from("sessions").insert(row).select("id, started_at").single();
    if (ins.error || !ins.data) die(`session insert: ${ins.error?.message}`);
    return ins.data as { id: string; started_at: string };
  };

  h("Sessions");
  const liveSess = await mkSession("live", 5 * 60000, 90, true);
  const upcomingSess = await mkSession("scheduled", -12 * 60000, 60, false); // starts in 12 min
  const recSess = await mkSession("ended", 2 * 3600000, 90, true, 1 * 3600000);
  info(`live=${liveSess.id.slice(0, 8)}  upcoming=${upcomingSess.id.slice(0, 8)}  recording=${recSess.id.slice(0, 8)}`);

  // chat helper: posted_at is explicit so replay offsets are deterministic.
  const chat = async (sessionId: string, author: string, body: string, postedAtMs: number, kind = "chat") => {
    const r = await admin.from("chat_messages").insert({ session_id: sessionId, author_id: author, body, kind, posted_at: new Date(postedAtMs).toISOString() });
    if (r.error) die(`chat insert: ${r.error.message}`);
  };

  h("Live-session seed chat (a couple of recent messages so it isn't empty)");
  await chat(liveSess.id, s1.user_id, "Good evening sir! 👋", Date.now() - 120000);
  await chat(liveSess.id, s2.user_id, "Excited for today's class", Date.now() - 60000);

  h("Recording-session chat history (offsets from started_at) + raised hands");
  const recStart = new Date(recSess.started_at).getTime();
  const off = (sec: number) => recStart + sec * 1000;
  await chat(recSess.id, s1.user_id, "Good evening sir!", off(5));
  await chat(recSess.id, s2.user_id, "Ready for kinematics 🚀", off(12));
  await chat(recSess.id, teacher.user_id, "We'll cover projectile motion today. Ask anytime.", off(30), "announcement");
  await chat(recSess.id, s1.user_id, "Can you explain the derivation again?", off(45));
  await chat(recSess.id, s2.user_id, "Same doubt here", off(70));
  await chat(recSess.id, teacher.user_id, "Sure — pausing to recap the formula.", off(95));
  await chat(recSess.id, s1.user_id, "Got it, thanks!", off(130));
  await chat(recSess.id, s2.user_id, "Crystal clear now 🙏", off(160));
  await chat(recSess.id, teacher.user_id, "Class has ended.", off(180), "system");

  await admin.from("raise_hand_events").insert([
    { session_id: recSess.id, student_id: s1.user_id, raised_at: new Date(off(40)).toISOString(), resolved_at: new Date(off(60)).toISOString(), resolved_by: teacher.user_id },
    { session_id: recSess.id, student_id: s2.user_id, raised_at: new Date(off(75)).toISOString(), resolved_at: new Date(off(100)).toISOString(), resolved_by: teacher.user_id },
  ]);

  h("Summary");
  console.log(`
Course:   ${courseCode}   Batch: P9_A_${ts}
Demo video (live + recording): https://youtu.be/${DEMO_VIDEO_ID}

Teacher  ${teacher.email} / ${teacher.initial_password}
  -> (teacher) Classes tab: the LIVE NOW row shows "Live control"; the UPCOMING
     row shows "Go live". Open live-control to moderate chat / raise-hand / pin /
     end. yt-broadcast-create returns "YouTube not configured" (expected) — you
     can still tap Go Live and run the whole in-app experience.

Student 1  ${s1.email} / ${s1.initial_password}
Student 2  ${s2.email} / ${s2.initial_password}
  -> (student) Classes tab segmented control:
       Live      -> the LIVE session: wrapped player + watermark + live chat +
                    raise hand. Sign in as Student 1 on one device and Student 2
                    (or the Teacher) on another to chat in real time.
       Upcoming  -> the UPCOMING session: lobby countdown (~12 min).
       Recorded  -> the ENDED session: wrapped player + chat REPLAY synced to the
                    video; try the 1×/1.5×/2× speed buttons.

Re-run with \`pnpm seed:live-manual-test --reset\` to wipe prior p9-* fixtures.
`);
}

main().catch((e) => { console.error(e); process.exit(1); });
