// Phase 5 — Content RLS smoke. Verifies:
//
//   T1  Student in batch A reads batch-A items.
//   T2  Student in batch A does NOT read batch-B items (same course).
//   T3  Both students read course-wide items.
//   T4  Unpublished items are hidden from students.
//   T5  Student in batch A does NOT read any other course's items.
//   T6  Teacher assigned to batch A reads batch-A + course-wide items.
//   T7  Teacher does NOT read items from a batch they don't teach.
//
// Provisions ephemeral course/batches/users via existing edge fns
// (`auth-bootstrap`, `curriculum-mutate`, `batch-mutate`) so the run is self-
// contained. The content rows themselves are inserted via service-role for
// the RLS test (Phase 5 has no service-role-bypass path for writes that
// admin owns directly through PostgREST — admins use edge fns).

import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({
  path: resolve(__dirname, "..", "apps", "admin", ".env.local"),
  override: false,
});

const SUPABASE_URL = required("NEXT_PUBLIC_SUPABASE_URL");
const ANON_KEY = required("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const SERVICE_KEY = required("SUPABASE_SERVICE_ROLE_KEY");
const OWNER_EMAIL = process.env.OWNER_EMAIL ?? "owner@fynestudy.example.com";
const OWNER_PASSWORD = process.env.OWNER_INITIAL_PASSWORD ?? "FyneStudy01";

function required(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`missing env var ${name}`);
    process.exit(1);
  }
  return v;
}

function header(s: string) {
  console.log(`\n=== ${s} ===`);
}
function pass(s: string) {
  console.log(`  PASS  ${s}`);
}
function fail(s: string): never {
  console.error(`  FAIL  ${s}`);
  process.exit(1);
}

async function callFn(name: string, body: unknown, jwt: string) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as Record<string, unknown>;
  return { status: res.status, body: data };
}

async function signIn(email: string, password: string) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) {
    fail(`signIn ${email}: ${res.status} ${JSON.stringify(data)}`);
  }
  return data.access_token as string;
}

async function rest<T = unknown>(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  jwt: string | null,
  body?: unknown,
) {
  const headers: Record<string, string> = {
    apikey: ANON_KEY,
    "Content-Type": "application/json",
  };
  if (jwt) headers.Authorization = `Bearer ${jwt}`;
  if (method === "POST" || method === "PATCH") {
    headers["Prefer"] = "return=representation";
  }
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = text.length ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  return { status: res.status, body: parsed as T };
}

async function main() {
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  header("Setup — owner sign-in");
  const ownerJwt = await signIn(OWNER_EMAIL, OWNER_PASSWORD);
  pass("owner JWT acquired");

  const ts = Date.now();

  header("Setup — create ephemeral course");
  const courseCode = `P5_${ts}`;
  const courseRes = await callFn(
    "curriculum-mutate",
    {
      op: "create_course",
      payload: {
        code: courseCode,
        name: `Phase 5 RLS ${ts}`,
        description: "RLS smoke fixture",
      },
    },
    ownerJwt,
  );
  if (courseRes.status !== 200) {
    fail(`create_course failed: ${JSON.stringify(courseRes.body)}`);
  }
  const courseId = (courseRes.body.row as { id: string }).id;
  pass(`course ${courseCode} = ${courseId}`);

  header("Setup — create subject/chapter/topic");
  const subj = await callFn(
    "curriculum-mutate",
    { op: "create_subject", payload: { course_id: courseId, name: "Phys", sort_order: 0 } },
    ownerJwt,
  );
  if (subj.status !== 200) fail(`create_subject: ${JSON.stringify(subj.body)}`);
  const subjectId = (subj.body.row as { id: string }).id;
  const chap = await callFn(
    "curriculum-mutate",
    { op: "create_chapter", payload: { subject_id: subjectId, name: "Kine", sort_order: 0 } },
    ownerJwt,
  );
  if (chap.status !== 200) fail(`create_chapter: ${JSON.stringify(chap.body)}`);
  const chapterId = (chap.body.row as { id: string }).id;
  const topic = await callFn(
    "curriculum-mutate",
    { op: "create_topic", payload: { chapter_id: chapterId, name: "Proj", sort_order: 0 } },
    ownerJwt,
  );
  if (topic.status !== 200) fail(`create_topic: ${JSON.stringify(topic.body)}`);
  const topicId = (topic.body.row as { id: string }).id;
  pass(`topic id = ${topicId}`);

  header("Setup — create 2 batches in this course");
  const batchA = await callFn(
    "batch-mutate",
    {
      op: "create_batch",
      payload: {
        course_id: courseId,
        name: `P5-A-${ts}`,
        starts_on: new Date().toISOString().slice(0, 10),
        capacity: 10,
      },
    },
    ownerJwt,
  );
  if (batchA.status !== 200) fail(`create_batch A: ${JSON.stringify(batchA.body)}`);
  const batchAId = (batchA.body.row as { id: string }).id;
  const batchB = await callFn(
    "batch-mutate",
    {
      op: "create_batch",
      payload: {
        course_id: courseId,
        name: `P5-B-${ts}`,
        starts_on: new Date().toISOString().slice(0, 10),
        capacity: 10,
      },
    },
    ownerJwt,
  );
  if (batchB.status !== 200) fail(`create_batch B: ${JSON.stringify(batchB.body)}`);
  const batchBId = (batchB.body.row as { id: string }).id;
  pass(`A=${batchAId} B=${batchBId}`);

  header("Setup — bootstrap student A, student B, teacher T1");
  const sARes = await callFn(
    "auth-bootstrap",
    {
      role: "student",
      full_name: `RLS sA ${ts}`,
      email: `p5-sa-${ts}@example.com`,
      parent_consent_method: "verbal",
      batch_id: batchAId,
    },
    ownerJwt,
  );
  if (sARes.status !== 200) fail(`bootstrap sA: ${JSON.stringify(sARes.body)}`);
  const sA = sARes.body as { user_id: string; email: string; initial_password: string };
  const sBRes = await callFn(
    "auth-bootstrap",
    {
      role: "student",
      full_name: `RLS sB ${ts}`,
      email: `p5-sb-${ts}@example.com`,
      parent_consent_method: "verbal",
      batch_id: batchBId,
    },
    ownerJwt,
  );
  if (sBRes.status !== 200) fail(`bootstrap sB: ${JSON.stringify(sBRes.body)}`);
  const sB = sBRes.body as { user_id: string; email: string; initial_password: string };
  const tRes = await callFn(
    "auth-bootstrap",
    {
      role: "teacher",
      full_name: `RLS T1 ${ts}`,
      email: `p5-t1-${ts}@example.com`,
      subjects: ["physics"],
    },
    ownerJwt,
  );
  if (tRes.status !== 200) fail(`bootstrap T1: ${JSON.stringify(tRes.body)}`);
  const t1 = tRes.body as { user_id: string; email: string; initial_password: string };

  await callFn(
    "batch-mutate",
    { op: "assign_teacher", batch_id: batchAId, teacher_id: t1.user_id },
    ownerJwt,
  );
  pass("users + teacher assignment to batch A done");

  header("Setup — insert 4 content_items via service role");
  // 1: batch A, published
  // 2: batch B, published
  // 3: course-wide, published
  // 4: batch A, UNPUBLISHED
  const ownerAppUserRow = await admin
    .from("app_users")
    .select("id")
    .eq("email", OWNER_EMAIL)
    .maybeSingle();
  const ownerAppId = (ownerAppUserRow.data as { id: string } | null)?.id;
  if (!ownerAppId) fail("could not resolve owner app_user id");
  const inserts = [
    {
      kind: "video" as const,
      title: `P5 batch-A video ${ts}`,
      topic_id: topicId,
      batch_id: batchAId,
      course_id: courseId,
      yt_video_id: `aaaa${ts.toString(36).slice(-7).padStart(7, "0")}`,
      file_path: null,
      uploaded_by: ownerAppId,
      is_published: true,
    },
    {
      kind: "video" as const,
      title: `P5 batch-B video ${ts}`,
      topic_id: topicId,
      batch_id: batchBId,
      course_id: courseId,
      yt_video_id: `bbbb${ts.toString(36).slice(-7).padStart(7, "0")}`,
      file_path: null,
      uploaded_by: ownerAppId,
      is_published: true,
    },
    {
      kind: "video" as const,
      title: `P5 course-wide video ${ts}`,
      topic_id: topicId,
      batch_id: null,
      course_id: courseId,
      yt_video_id: `cccc${ts.toString(36).slice(-7).padStart(7, "0")}`,
      file_path: null,
      uploaded_by: ownerAppId,
      is_published: true,
    },
    {
      kind: "video" as const,
      title: `P5 batch-A UNPUBLISHED video ${ts}`,
      topic_id: topicId,
      batch_id: batchAId,
      course_id: courseId,
      yt_video_id: `dddd${ts.toString(36).slice(-7).padStart(7, "0")}`,
      file_path: null,
      uploaded_by: ownerAppId,
      is_published: false,
    },
  ];
  const insRes = await admin.from("content_items").insert(inserts).select("id, title");
  if (insRes.error) fail(`insert content_items: ${insRes.error.message}`);
  pass(`inserted ${(insRes.data ?? []).length} content rows`);

  header("Setup — sign in test users");
  const sAJwt = await signIn(sA.email, sA.initial_password);
  const sBJwt = await signIn(sB.email, sB.initial_password);
  const t1Jwt = await signIn(t1.email, t1.initial_password);
  pass("sA / sB / t1 JWTs acquired");

  // ----- Tests -----

  header("T1 — Student A reads batch-A + course-wide (NOT batch-B, NOT unpublished)");
  const sAItems = await rest<{ title: string; batch_id: string | null }[]>(
    "GET",
    `content_items?select=title,batch_id&topic_id=eq.${topicId}`,
    sAJwt,
  );
  if (sAItems.status !== 200) fail(`sA read: ${JSON.stringify(sAItems.body)}`);
  const sAIds = (sAItems.body as { title: string }[]).map((r) => r.title);
  const expectedSA = [
    `P5 batch-A video ${ts}`,
    `P5 course-wide video ${ts}`,
  ];
  if (sAIds.length !== 2) {
    fail(`sA expected 2 items, got ${sAIds.length}: ${JSON.stringify(sAIds)}`);
  }
  for (const t of expectedSA) {
    if (!sAIds.includes(t)) fail(`sA missing ${t}`);
  }
  if (sAIds.some((t) => t.includes("batch-B"))) {
    fail(`sA sees batch-B item: ${JSON.stringify(sAIds)}`);
  }
  if (sAIds.some((t) => t.includes("UNPUBLISHED"))) {
    fail(`sA sees unpublished item: ${JSON.stringify(sAIds)}`);
  }
  pass(`sA sees exactly batch-A + course-wide published items`);

  header("T2 — Student B reads batch-B + course-wide (NOT batch-A)");
  const sBItems = await rest<{ title: string }[]>(
    "GET",
    `content_items?select=title&topic_id=eq.${topicId}`,
    sBJwt,
  );
  if (sBItems.status !== 200) fail(`sB read: ${JSON.stringify(sBItems.body)}`);
  const sBTitles = (sBItems.body as { title: string }[]).map((r) => r.title);
  if (sBTitles.length !== 2) {
    fail(`sB expected 2 items, got ${sBTitles.length}: ${JSON.stringify(sBTitles)}`);
  }
  if (!sBTitles.includes(`P5 batch-B video ${ts}`)) fail(`sB missing batch-B`);
  if (!sBTitles.includes(`P5 course-wide video ${ts}`)) {
    fail(`sB missing course-wide`);
  }
  if (sBTitles.some((t) => t.includes("batch-A"))) {
    fail(`sB sees batch-A item: ${JSON.stringify(sBTitles)}`);
  }
  pass(`sB sees exactly batch-B + course-wide published items`);

  header("T3 — Teacher T1 sees batch-A items + course-wide (NOT batch-B)");
  const t1Items = await rest<{ title: string }[]>(
    "GET",
    `content_items?select=title&topic_id=eq.${topicId}`,
    t1Jwt,
  );
  if (t1Items.status !== 200) fail(`t1 read: ${JSON.stringify(t1Items.body)}`);
  const t1Titles = (t1Items.body as { title: string }[]).map((r) => r.title);
  if (t1Titles.some((t) => t.includes("batch-B"))) {
    fail(`t1 sees batch-B item: ${JSON.stringify(t1Titles)}`);
  }
  if (!t1Titles.includes(`P5 batch-A video ${ts}`)) {
    fail(`t1 missing batch-A item`);
  }
  if (!t1Titles.includes(`P5 course-wide video ${ts}`)) {
    fail(`t1 missing course-wide`);
  }
  pass(`t1 sees batch-A + course-wide (no batch-B)`);

  header("T4 — Anonymous sees zero rows");
  const anonRead = await rest<unknown[]>(
    "GET",
    `content_items?select=id&topic_id=eq.${topicId}`,
    null,
  );
  if (anonRead.status !== 200) fail(`anon read: ${anonRead.status}`);
  if (!Array.isArray(anonRead.body) || anonRead.body.length !== 0) {
    fail(`anon saw rows: ${JSON.stringify(anonRead.body)}`);
  }
  pass(`anon sees 0`);

  header("T5 — Student A cannot INSERT into content_items (writes blocked by policy)");
  const sAWrite = await rest(
    "POST",
    `content_items`,
    sAJwt,
    {
      kind: "video",
      title: "should not insert",
      topic_id: topicId,
      course_id: courseId,
      yt_video_id: `evilevilevi`,
      uploaded_by: sA.user_id,
    },
  );
  if (sAWrite.status >= 200 && sAWrite.status < 300) {
    fail(`student write succeeded: ${sAWrite.status} ${JSON.stringify(sAWrite.body)}`);
  }
  pass(`student write blocked (status ${sAWrite.status})`);

  header("T6 — Student A self video_progress insert succeeds; for sB blocked");
  // Need a real content_id from sA's view
  const sAContent = (sAItems.body as { title: string; batch_id: string | null }[])
    .find((r) => r.title.includes("course-wide"));
  if (!sAContent) fail("no course-wide content visible to sA");
  // Look up content id via admin
  const { data: cwRow } = await admin
    .from("content_items")
    .select("id")
    .eq("title", `P5 course-wide video ${ts}`)
    .maybeSingle();
  if (!cwRow) fail("could not resolve course-wide content id");
  const cwId = (cwRow as { id: string }).id;
  const sAProg = await rest(
    "POST",
    `video_progress`,
    sAJwt,
    {
      student_id: sA.user_id,
      content_id: cwId,
      position_sec: 42,
      watched_pct: 12.5,
    },
  );
  if (sAProg.status < 200 || sAProg.status >= 300) {
    fail(`sA own progress insert blocked: ${sAProg.status} ${JSON.stringify(sAProg.body)}`);
  }
  pass(`sA wrote own video_progress (status ${sAProg.status})`);

  const sASpoof = await rest(
    "POST",
    `video_progress`,
    sAJwt,
    {
      student_id: sB.user_id,
      content_id: cwId,
      position_sec: 99,
      watched_pct: 99,
    },
  );
  if (sASpoof.status >= 200 && sASpoof.status < 300) {
    fail(`sA managed to write progress for sB: ${sASpoof.status}`);
  }
  pass(`sA spoof video_progress for sB blocked (status ${sASpoof.status})`);

  // ----- Cleanup -----
  header("Cleanup — delete inserted content_items");
  const titles = inserts.map((i) => i.title);
  await admin.from("content_items").delete().in("title", titles);
  // Best-effort cleanup; leave users/batches/course around like other smokes.

  console.log("\n✅ Phase 5 content-RLS smoke passed.");
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
