// Phase 5 — Manual-test fixture.
//
// Creates:
//   - 1 course (P5_TEST_<ts>) with subject "Physics" + chapter "Mechanics"
//     + topic "Kinematics"
//   - 2 batches in that course:
//       Batch A (test target — has the teacher + student 1 + student 2)
//       Batch B (cross-batch — has student 3, NO teacher)
//   - 1 teacher (assigned to batch A only)
//   - 3 students: 2 in Batch A, 1 in Batch B
//   - 5 pre-uploaded content items (so the library has something to show):
//       1× video, batch-A-scoped, published      → Student 1+2 see it
//       1× video, batch-B-scoped, published      → Student 3 only
//       1× pdf,   course-wide, published         → All three see it
//       1× pdf,   batch-A-scoped, UNPUBLISHED    → Nobody sees it (admin pending)
//       1× note,  batch-A-scoped, published      → Student 1+2 see it
//
// The PDF content items have REAL Storage objects under
// `study-materials/<course>/<topic>/<uuid>.pdf` so the in-app reader can
// load them. We use a tiny 9-byte test PDF — fine for testing rendering;
// pdf.js will show "PDF page 1 of 1" with a blank page.
//
//   pnpm seed:content-manual-test

import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

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

async function callFn(name: string, body: unknown, jwt: string) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: res.status, body: data };
}

async function signIn(email: string, password: string) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`signIn ${email}: ${res.status} ${JSON.stringify(data)}`);
  return data.access_token as string;
}

async function bootstrap(
  admin: SupabaseClient,
  ownerJwt: string,
  payload: Record<string, unknown>,
) {
  const res = await callFn("auth-bootstrap", payload, ownerJwt);
  if (res.status !== 200) {
    throw new Error(`bootstrap failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  const body = res.body as { user_id: string; email: string; initial_password: string };
  await admin
    .from("app_users")
    .update({ must_change_password: false })
    .eq("id", body.user_id);
  return body;
}

async function main() {
  const ts = Date.now();
  const label = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

  console.log(`Seeding Phase 5 content manual-test fixtures (label ${label})…`);

  const ownerJwt = await signIn(OWNER_EMAIL, OWNER_PASSWORD);
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1) Course
  const courseCode = `P5_TEST_${ts}`;
  const cRes = await callFn(
    "curriculum-mutate",
    {
      op: "create_course",
      payload: { code: courseCode, name: `Phase 5 Manual ${label}` },
    },
    ownerJwt,
  );
  if (cRes.status !== 200) throw new Error(`course: ${JSON.stringify(cRes.body)}`);
  const courseId = (cRes.body.row as { id: string }).id;

  // 2) Subject → Chapter → Topic chain
  const sRes = await callFn(
    "curriculum-mutate",
    {
      op: "create_subject",
      payload: { course_id: courseId, name: "Physics", sort_order: 0 },
    },
    ownerJwt,
  );
  const subjectId = (sRes.body.row as { id: string }).id;
  const ch = await callFn(
    "curriculum-mutate",
    {
      op: "create_chapter",
      payload: { subject_id: subjectId, name: "Mechanics", sort_order: 0 },
    },
    ownerJwt,
  );
  const chapterId = (ch.body.row as { id: string }).id;
  const tp = await callFn(
    "curriculum-mutate",
    {
      op: "create_topic",
      payload: { chapter_id: chapterId, name: "Kinematics", sort_order: 0 },
    },
    ownerJwt,
  );
  const topicId = (tp.body.row as { id: string }).id;

  // Add a second topic for richer navigation
  const tp2 = await callFn(
    "curriculum-mutate",
    {
      op: "create_topic",
      payload: { chapter_id: chapterId, name: "Newton's Laws", sort_order: 1 },
    },
    ownerJwt,
  );
  const topic2Id = (tp2.body.row as { id: string }).id;

  // 3) Two batches
  const bAReq = await callFn(
    "batch-mutate",
    {
      op: "create_batch",
      payload: {
        course_id: courseId,
        name: `P5 Batch A ${label}`,
        starts_on: new Date().toISOString().slice(0, 10),
        capacity: 10,
      },
    },
    ownerJwt,
  );
  const batchAId = (bAReq.body.row as { id: string }).id;
  const bBReq = await callFn(
    "batch-mutate",
    {
      op: "create_batch",
      payload: {
        course_id: courseId,
        name: `P5 Batch B ${label}`,
        starts_on: new Date().toISOString().slice(0, 10),
        capacity: 10,
      },
    },
    ownerJwt,
  );
  const batchBId = (bBReq.body.row as { id: string }).id;

  // 4) Users
  const teacher = await bootstrap(admin, ownerJwt, {
    role: "teacher",
    full_name: `P5 Teacher ${label}`,
    email: `p5-teacher-${ts}@fynestudy.example.com`,
    phone: "+919999990001",
    subjects: ["physics"],
  });
  await callFn(
    "batch-mutate",
    { op: "assign_teacher", batch_id: batchAId, teacher_id: teacher.user_id },
    ownerJwt,
  );
  const student1 = await bootstrap(admin, ownerJwt, {
    role: "student",
    full_name: `P5 Student One ${label}`,
    email: `p5-stu-1-${ts}@fynestudy.example.com`,
    phone: "+919999991001",
    batch_id: batchAId,
    parent_consent_method: "verbal",
  });
  const student2 = await bootstrap(admin, ownerJwt, {
    role: "student",
    full_name: `P5 Student Two ${label}`,
    email: `p5-stu-2-${ts}@fynestudy.example.com`,
    phone: "+919999992002",
    batch_id: batchAId,
    parent_consent_method: "verbal",
  });
  const student3 = await bootstrap(admin, ownerJwt, {
    role: "student",
    full_name: `P5 Student Three ${label}`,
    email: `p5-stu-3-${ts}@fynestudy.example.com`,
    phone: "+919999993003",
    batch_id: batchBId,
    parent_consent_method: "verbal",
  });

  // 5) Pre-uploaded content
  const ownerRow = await admin
    .from("app_users")
    .select("id")
    .eq("email", OWNER_EMAIL)
    .single();
  const ownerAppId = (ownerRow.data as { id: string }).id;

  const tinyPdf = new Uint8Array([
    0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, // %PDF-1.4\n
  ]);

  // Helper to upload a PDF into storage at a deterministic path
  async function uploadPdf(pathSuffix: string): Promise<string> {
    const path = `${courseId}/${topicId}/${pathSuffix}.pdf`;
    const { error } = await admin.storage
      .from("study-materials")
      .upload(path, tinyPdf, {
        contentType: "application/pdf",
        upsert: true,
      });
    if (error) throw new Error(`storage upload ${path}: ${error.message}`);
    return path;
  }

  // a) batch-A video, published
  await admin.from("content_items").insert({
    kind: "video",
    title: "Intro to Projectile Motion (Batch A only)",
    description: "Watch this first.",
    topic_id: topicId,
    batch_id: batchAId,
    course_id: courseId,
    yt_video_id: `dQw4w9WgX${(ts % 100).toString().padStart(2, "0")}`,
    duration_sec: 215,
    uploaded_by: ownerAppId,
    is_published: true,
  });
  // b) batch-B video, published
  await admin.from("content_items").insert({
    kind: "video",
    title: "Newton's Laws (Batch B only)",
    description: "Cross-batch invisible to A.",
    topic_id: topic2Id,
    batch_id: batchBId,
    course_id: courseId,
    yt_video_id: `oHg5SJYRH${(ts % 100).toString().padStart(2, "0")}`,
    duration_sec: 320,
    uploaded_by: ownerAppId,
    is_published: true,
  });
  // c) course-wide pdf, published
  const cwPath = await uploadPdf(`cw-${ts}`);
  await admin.from("content_items").insert({
    kind: "pdf",
    title: "Kinematics Formula Sheet (course-wide)",
    description: "Visible to every student in this course.",
    topic_id: topicId,
    batch_id: null,
    course_id: courseId,
    file_path: cwPath,
    file_size_bytes: tinyPdf.length,
    mime_type: "application/pdf",
    uploaded_by: ownerAppId,
    is_published: true,
  });
  // d) batch-A pdf, UNPUBLISHED (admin moderation pending)
  const pendingPath = await uploadPdf(`pending-${ts}`);
  await admin.from("content_items").insert({
    kind: "pdf",
    title: "Pending review — should NOT be visible to students",
    topic_id: topicId,
    batch_id: batchAId,
    course_id: courseId,
    file_path: pendingPath,
    file_size_bytes: tinyPdf.length,
    mime_type: "application/pdf",
    uploaded_by: ownerAppId,
    is_published: false,
  });
  // e) batch-A note, published
  const notePath = await uploadPdf(`note-${ts}`);
  await admin.from("content_items").insert({
    kind: "note",
    title: "Lecture notes — Batch A",
    topic_id: topicId,
    batch_id: batchAId,
    course_id: courseId,
    file_path: notePath,
    file_size_bytes: tinyPdf.length,
    mime_type: "application/pdf",
    uploaded_by: ownerAppId,
    is_published: true,
  });

  console.log("================================================================");
  console.log("  Phase 5 content fixtures READY");
  console.log("================================================================");
  console.log("");
  console.log(`  Course code:        ${courseCode}`);
  console.log(`  Course id:          ${courseId}`);
  console.log(`  Subject id:         ${subjectId}  (Physics)`);
  console.log(`  Chapter id:         ${chapterId}  (Mechanics)`);
  console.log(`  Topic 1 id:         ${topicId}  (Kinematics)`);
  console.log(`  Topic 2 id:         ${topic2Id}  (Newton's Laws)`);
  console.log(`  Batch A id:         ${batchAId}  (has teacher + S1 + S2)`);
  console.log(`  Batch B id:         ${batchBId}  (has S3 only)`);
  console.log("");
  console.log("  ── TEACHER (Batch A) ──");
  console.log(`  Email:              ${teacher.email}`);
  console.log(`  Password:           ${teacher.initial_password}`);
  console.log("");
  console.log("  ── STUDENT 1 (Batch A) ──");
  console.log(`  Email:              ${student1.email}`);
  console.log(`  Password:           ${student1.initial_password}`);
  console.log(`  Watermark text:     P5 • ••1001`);
  console.log("");
  console.log("  ── STUDENT 2 (Batch A) ──");
  console.log(`  Email:              ${student2.email}`);
  console.log(`  Password:           ${student2.initial_password}`);
  console.log(`  Watermark text:     P5 • ••2002`);
  console.log("");
  console.log("  ── STUDENT 3 (Batch B) ──");
  console.log(`  Email:              ${student3.email}`);
  console.log(`  Password:           ${student3.initial_password}`);
  console.log(`  Watermark text:     P5 • ••3003`);
  console.log("");
  console.log("  ── PRE-UPLOADED CONTENT ──");
  console.log("  a) Video  'Intro to Projectile Motion'  Batch A  Published");
  console.log("  b) Video  'Newton's Laws'               Batch B  Published");
  console.log("  c) PDF    'Kinematics Formula Sheet'    Course-wide  Published");
  console.log("  d) PDF    'Pending review — …'          Batch A  UNPUBLISHED");
  console.log("  e) Note   'Lecture notes — Batch A'     Batch A  Published");
  console.log("");
  console.log("  Visibility map:");
  console.log("    Student 1 (Batch A) should see:   a, c, e  (3 items)");
  console.log("    Student 2 (Batch A) should see:   a, c, e  (3 items)");
  console.log("    Student 3 (Batch B) should see:   b, c     (2 items)");
  console.log("    Teacher    (Batch A) should see:  a, c, e  (course-wide + Batch A)");
  console.log("");
  console.log("================================================================");
}

main().catch((err) => {
  console.error("FAILED:", err instanceof Error ? err.stack : err);
  process.exit(1);
});
