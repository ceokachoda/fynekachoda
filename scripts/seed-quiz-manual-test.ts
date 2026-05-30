// Phase 6 — Manual-test fixture for practice quizzes.
//
// Creates:
//   - 1 course (P6_TEST_<ts>) with subject "Physics" + chapter "Mechanics"
//     + topics "Kinematics" and "Vectors"
//   - 2 batches in that course:
//       Batch A (test target — teacher + student 1 + student 2)
//       Batch B (cross-batch — student 3, NO teacher)
//   - 1 teacher (assigned to batch A only)
//   - 3 students: 2 in Batch A, 1 in Batch B
//   - 1 published reference video (used by "Related video" in solution view)
//   - 5 pre-built questions (4 in Kinematics, 1 in Vectors); each has 4
//     options with exactly 1 correct + an explanation, with one linked to
//     the reference video.
//   - 3 quizzes:
//       Quiz 1 ("Kinematics — Easy 4")  batch-A-scoped, published, 4Q, +4/-1
//       Quiz 2 ("Vectors — Hard 1")     course-wide,    published, 1Q, +4/-1
//       Quiz 3 ("Drafts — hidden")      batch-A-scoped, DRAFT,    1Q
//
// Run:
//   pnpm seed:quiz-manual-test          # creates fresh fixtures (idempotent ts in names)
//   pnpm seed:quiz-manual-test --reset  # also wipes prior `p6-*` fixtures first
//
// Prints credentials at the end so you can sign in on mobile + web admin.

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
const RESET = process.argv.includes("--reset");

function required(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`missing env var ${name}`);
    process.exit(1);
  }
  return v;
}
function h(s: string) { console.log(`\n== ${s} ==`); }
function info(s: string) { console.log(`   ${s}`); }
function die(s: string): never {
  console.error(`FAIL ${s}`);
  process.exit(1);
}

async function signIn(email: string, password: string) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) die(`signIn ${email}: ${res.status} ${JSON.stringify(data)}`);
  return data.access_token as string;
}

async function callFn(name: string, body: unknown, jwt: string, allowStatuses: number[] = []) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status !== 200 && !allowStatuses.includes(res.status)) {
    die(`callFn ${name}: ${res.status} ${JSON.stringify(data)}`);
  }
  return { status: res.status, data: data as Record<string, unknown> };
}

async function resetPriorFixtures(admin: SupabaseClient) {
  h("Reset — wiping prior `p6-*` fixtures");
  const stale = await admin
    .from("app_users")
    .select("id, auth_user_id, email")
    .like("email", "p6-%")
    .limit(500);
  const ids = (stale.data ?? []).map((r) => r.id as string);
  const authIds = (stale.data ?? []).map((r) => r.auth_user_id as string);
  if (ids.length > 0) {
    // delete dependent rows first (RLS off via service role).
    await admin.from("quiz_answers").delete().in(
      "attempt_id",
      (await admin.from("quiz_attempts").select("id").in("student_id", ids))
        .data?.map((r: { id: string }) => r.id) ?? [],
    );
    await admin.from("quiz_attempts").delete().in("student_id", ids);
    await admin.from("video_progress").delete().in("student_id", ids);
    await admin.from("pdf_progress").delete().in("student_id", ids);
    await admin.from("attendance").delete().in("student_id", ids);
    await admin.from("activity_days").delete().in("student_id", ids);
    await admin.from("batch_teachers").delete().in("teacher_id", ids);
    await admin.from("students").delete().in("user_id", ids);
    await admin.from("teachers").delete().in("user_id", ids);
    await admin.from("user_roles").delete().in("user_id", ids);
    await admin.from("audit_log").delete().in("actor_user_id", ids);
    // NOTE: app_users + auth users are deleted at the END of this function,
    // after the course block removes the teacher's quizzes/questions. Those
    // tables NO ACTION-reference app_users.id, so deleting identities here
    // would abort (and silently orphan the teachers/batch_teachers rows above).
  }
  // Drop prior P6_TEST_* courses + their batches/quizzes/questions cascade.
  const oldCourses = await admin
    .from("courses")
    .select("id, code")
    .like("code", "P6_TEST_%");
  const oldCourseIds = (oldCourses.data ?? []).map((r) => r.id as string);
  if (oldCourseIds.length > 0) {
    const oldBatches = await admin
      .from("batches")
      .select("id")
      .in("course_id", oldCourseIds);
    const bIds = (oldBatches.data ?? []).map((r) => r.id as string);
    await admin.from("quizzes").delete().in("course_id", oldCourseIds);
    await admin.from("content_items").delete().in("course_id", oldCourseIds);
    // Cascade through subjects → chapters → topics → questions (FK restrict
    // means we must delete questions explicitly first).
    const topicQ = await admin
      .from("topics")
      .select("id, chapter_id, chapters!inner(subject_id, subjects!inner(course_id))")
      // Topics whose course chain matches; do via subjects+chapters join.
      .in("chapters.subjects.course_id", oldCourseIds);
    const tIds = (topicQ.data ?? []).map((r: { id: string }) => r.id);
    if (tIds.length > 0) {
      await admin.from("questions").delete().in("topic_id", tIds);
    }
    await admin.from("batches").delete().in("id", bIds);
    await admin.from("courses").delete().in("id", oldCourseIds);
    info(`deleted ${oldCourseIds.length} prior P6_TEST_* courses (+ cascaded children)`);
  }

  // Now that course-owned quizzes/questions/content are gone, the identities
  // are unreferenced. Delete per-id so one still-referenced row can't abort the
  // whole batch (which is what previously left orphaned p6-* teachers behind).
  if (ids.length > 0) {
    let deleted = 0;
    for (let i = 0; i < ids.length; i++) {
      const { error } = await admin.from("app_users").delete().eq("id", ids[i]!);
      if (error) {
        info(`skipped app_user ${ids[i]} (still referenced): ${error.message}`);
        continue;
      }
      try {
        await admin.auth.admin.deleteUser(authIds[i]!);
      } catch {}
      deleted++;
    }
    info(`deleted ${deleted}/${ids.length} prior p6-* users`);
  }
}

async function main() {
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const ownerJwt = await signIn(OWNER_EMAIL, OWNER_PASSWORD);

  if (RESET) await resetPriorFixtures(admin);

  const ts = Date.now();
  const courseCode = `P6_TEST_${ts}`;

  h("Curriculum");
  const c = await callFn(
    "curriculum-mutate",
    { op: "create_course", payload: { code: courseCode, name: `Phase 6 Test ${ts}` } },
    ownerJwt,
  );
  const courseId = (c.data.row as { id: string }).id;
  const s = await callFn(
    "curriculum-mutate",
    { op: "create_subject", payload: { course_id: courseId, name: "Physics", sort_order: 0 } },
    ownerJwt,
  );
  const subjectId = (s.data.row as { id: string }).id;
  const ch = await callFn(
    "curriculum-mutate",
    { op: "create_chapter", payload: { subject_id: subjectId, name: "Mechanics", sort_order: 0 } },
    ownerJwt,
  );
  const chapterId = (ch.data.row as { id: string }).id;
  const t1 = await callFn(
    "curriculum-mutate",
    { op: "create_topic", payload: { chapter_id: chapterId, name: "Kinematics", sort_order: 0 } },
    ownerJwt,
  );
  const topicKin = (t1.data.row as { id: string }).id;
  const t2 = await callFn(
    "curriculum-mutate",
    { op: "create_topic", payload: { chapter_id: chapterId, name: "Vectors", sort_order: 1 } },
    ownerJwt,
  );
  const topicVec = (t2.data.row as { id: string }).id;
  info(`course=${courseId.slice(0, 8)}… topics: Kinematics + Vectors`);

  h("Batches");
  const today = new Date().toISOString().slice(0, 10);
  const ba = await callFn(
    "batch-mutate",
    { op: "create_batch", payload: { course_id: courseId, name: `P6_A_${ts}`, starts_on: today, capacity: 30 } },
    ownerJwt,
  );
  const batchAId = (ba.data.row as { id: string }).id;
  const bb = await callFn(
    "batch-mutate",
    { op: "create_batch", payload: { course_id: courseId, name: `P6_B_${ts}`, starts_on: today, capacity: 30 } },
    ownerJwt,
  );
  const batchBId = (bb.data.row as { id: string }).id;
  info(`batch A=${batchAId.slice(0,8)}… B=${batchBId.slice(0,8)}…`);

  h("Users");
  const tcr = await callFn(
    "auth-bootstrap",
    {
      role: "teacher",
      full_name: `P6 Teacher ${ts}`,
      email: `p6-teach-${ts}@fynestudy.example.com`,
      subjects: ["physics"],
    },
    ownerJwt,
  );
  const teacher = tcr.data as { user_id: string; auth_user_id: string; email: string; initial_password: string };
  await callFn("batch-mutate", { op: "assign_teacher", batch_id: batchAId, teacher_id: teacher.user_id }, ownerJwt);

  const stuA1r = await callFn("auth-bootstrap", {
    role: "student", full_name: `P6 Student A1 ${ts}`,
    email: `p6-stu-a1-${ts}@fynestudy.example.com`,
    parent_consent_method: "verbal", batch_id: batchAId,
  }, ownerJwt);
  const stuA2r = await callFn("auth-bootstrap", {
    role: "student", full_name: `P6 Student A2 ${ts}`,
    email: `p6-stu-a2-${ts}@fynestudy.example.com`,
    parent_consent_method: "verbal", batch_id: batchAId,
  }, ownerJwt);
  const stuB1r = await callFn("auth-bootstrap", {
    role: "student", full_name: `P6 Student B1 ${ts}`,
    email: `p6-stu-b1-${ts}@fynestudy.example.com`,
    parent_consent_method: "verbal", batch_id: batchBId,
  }, ownerJwt);
  const stuA1 = stuA1r.data as { user_id: string; auth_user_id: string; email: string; initial_password: string };
  const stuA2 = stuA2r.data as { user_id: string; auth_user_id: string; email: string; initial_password: string };
  const stuB1 = stuB1r.data as { user_id: string; auth_user_id: string; email: string; initial_password: string };

  // Skip force-password-change so the test accounts are ready to use.
  await admin.from("app_users").update({ must_change_password: false })
    .in("id", [teacher.user_id, stuA1.user_id, stuA2.user_id, stuB1.user_id]);
  info(`teacher: ${teacher.email}`);
  info(`student A1: ${stuA1.email}`);
  info(`student A2: ${stuA2.email}`);
  info(`student B1: ${stuB1.email}`);

  h("Reference video (used by 'Related Video' in solution view)");
  // Pick a Rick Astley placeholder — replace with a real Unlisted YT URL in
  // production. yt-create-video may or may not verify against YT_DATA_API
  // depending on Vault keys; either path is fine for fixture seeding.
  let refContentId: string | null = null;
  try {
    // Use a distinct id per seed run so re-seeds don't trip the unique
    // constraint on `content_items.yt_video_id`.
    const ytId = "p6sd" + ts.toString().slice(-7);
    const v = await callFn(
      "content-create-video",
      {
        yt_url_or_id: ytId,
        topic_id: topicKin,
        title: "Intro to Kinematics (placeholder)",
        batch_id: batchAId,
      },
      ownerJwt,
      [200, 400, 404, 409, 422, 500],
    );
    if (v.status === 200) {
      refContentId = ((v.data as { content_item: { id: string } }).content_item ?? null)?.id ?? null;
    } else {
      info(`content-create-video skipped (status ${v.status})`);
    }
  } catch (e) {
    info(`content-create-video error: ${(e as Error).message}`);
  }

  h("Questions + options + solutions");
  const teacherJwt = await signIn(teacher.email, teacher.initial_password);
  async function makeQ(
    topicId: string,
    prompt: string,
    options: { text: string; correct?: boolean }[],
    explanation: string,
    related_content_id?: string | null,
  ) {
    const qi = await admin
      .from("questions")
      .insert({
        topic_id: topicId, prompt_md: prompt,
        difficulty: ["easy", "medium", "hard"][Math.floor(Math.random() * 3)] as "easy"|"medium"|"hard",
        created_by: teacher.user_id,
      })
      .select("id").single();
    if (qi.error || !qi.data) die(`q insert: ${qi.error?.message}`);
    const qid = qi.data.id;
    await admin.from("question_options").insert(
      options.map((o, i) => ({
        question_id: qid, text_md: o.text, is_correct: !!o.correct, sort_order: i,
      })),
    );
    await admin.from("question_solutions").insert({
      question_id: qid,
      explanation_md: explanation,
      related_content_id: related_content_id ?? null,
    });
    return qid;
  }

  const q1 = await makeQ(
    topicKin,
    "What is the SI unit of acceleration?",
    [
      { text: "m/s² (correct)", correct: true },
      { text: "m/s" },
      { text: "kg·m/s" },
      { text: "N·m" },
    ],
    "Acceleration is the rate of change of velocity per unit time, hence m/s².",
    refContentId,
  );
  const q2 = await makeQ(
    topicKin,
    "A ball is dropped from rest. After 2 s of free fall, what is its speed? (g = 10 m/s²)",
    [
      { text: "5 m/s" },
      { text: "10 m/s" },
      { text: "20 m/s (correct)", correct: true },
      { text: "40 m/s" },
    ],
    "Using v = u + gt with u = 0, g = 10 m/s², t = 2 s → v = 20 m/s.",
  );
  const q3 = await makeQ(
    topicKin,
    "Which graph represents uniform velocity?",
    [
      { text: "Straight horizontal line on a v-t graph (correct)", correct: true },
      { text: "Parabola on a v-t graph" },
      { text: "Sinusoidal curve on v-t" },
      { text: "Inverted parabola on v-t" },
    ],
    "Uniform velocity ⇒ constant v ⇒ horizontal line on the v–t graph.",
  );
  const q4 = await makeQ(
    topicKin,
    "If displacement is zero but distance is not, the body has:",
    [
      { text: "Stopped" },
      { text: "Moved in a straight line" },
      { text: "Returned to its starting point (correct)", correct: true },
      { text: "Reached escape velocity" },
    ],
    "Displacement zero with non-zero distance ⇒ the body returned to its origin.",
  );
  const q5 = await makeQ(
    topicVec,
    "The dot product of two perpendicular vectors is:",
    [
      { text: "Maximum" },
      { text: "Their magnitudes' sum" },
      { text: "Zero (correct)", correct: true },
      { text: "Negative of the cross product" },
    ],
    "cos 90° = 0 ⇒ A · B = |A||B|cosθ = 0.",
  );

  h("Quizzes");
  const quiz1 = await admin
    .from("quizzes")
    .insert({
      title: "Kinematics — Easy 4",
      topic_id: topicKin,
      course_id: courseId,
      batch_id: batchAId,
      duration_min: 5,
      marks_correct: 4, marks_wrong: -1, marks_skip: 0,
      randomize_questions: true, randomize_options: true,
      is_published: true,
      created_by: teacher.user_id,
    })
    .select("id").single();
  if (quiz1.error || !quiz1.data) die(`quiz1: ${quiz1.error?.message}`);
  const quiz1Id = quiz1.data.id;
  await admin.from("quiz_questions").insert([
    { quiz_id: quiz1Id, question_id: q1, sort_order: 0 },
    { quiz_id: quiz1Id, question_id: q2, sort_order: 1 },
    { quiz_id: quiz1Id, question_id: q3, sort_order: 2 },
    { quiz_id: quiz1Id, question_id: q4, sort_order: 3 },
  ]);

  const quiz2 = await admin
    .from("quizzes")
    .insert({
      title: "Vectors — Hard 1",
      topic_id: topicVec,
      course_id: courseId,
      batch_id: null, // course-wide → visible to both batches
      duration_min: 2,
      marks_correct: 4, marks_wrong: -1, marks_skip: 0,
      randomize_questions: false, randomize_options: false,
      is_published: true,
      created_by: teacher.user_id,
    })
    .select("id").single();
  if (quiz2.error || !quiz2.data) die(`quiz2: ${quiz2.error?.message}`);
  const quiz2Id = quiz2.data.id;
  await admin.from("quiz_questions").insert([
    { quiz_id: quiz2Id, question_id: q5, sort_order: 0 },
  ]);

  const quiz3 = await admin
    .from("quizzes")
    .insert({
      title: "Drafts — hidden",
      topic_id: topicKin,
      course_id: courseId,
      batch_id: batchAId,
      duration_min: 10,
      marks_correct: 4, marks_wrong: -1, marks_skip: 0,
      is_published: false, // draft
      created_by: teacher.user_id,
    })
    .select("id").single();
  if (quiz3.error || !quiz3.data) die(`quiz3: ${quiz3.error?.message}`);
  const quiz3Id = quiz3.data.id;
  await admin.from("quiz_questions").insert([
    { quiz_id: quiz3Id, question_id: q1, sort_order: 0 },
  ]);

  h("Summary");
  console.log(`
Course:     ${courseCode}
Batch A:    ${batchAId}
Batch B:    ${batchBId}
Topic IDs:  Kinematics=${topicKin}, Vectors=${topicVec}

Teacher
  Email     ${teacher.email}
  Password  ${teacher.initial_password}

Student A1 (Batch A, has the published Quiz 1 + Quiz 2 visible)
  Email     ${stuA1.email}
  Password  ${stuA1.initial_password}

Student A2 (Batch A — same scope as A1)
  Email     ${stuA2.email}
  Password  ${stuA2.initial_password}

Student B1 (Batch B — Quiz 1 NOT visible; Quiz 2 IS visible course-wide)
  Email     ${stuB1.email}
  Password  ${stuB1.initial_password}

Quizzes:
  Quiz 1    "Kinematics — Easy 4"  published  batch_A  4 questions  ${quiz1Id}
  Quiz 2    "Vectors — Hard 1"     published  course-wide  1 question  ${quiz2Id}
  Quiz 3    "Drafts — hidden"      DRAFT      batch_A  1 question  ${quiz3Id}

All four accounts already have must_change_password=false so you can sign in
straight away. Re-run with \`pnpm seed:quiz-manual-test --reset\` to wipe prior
\`p6-*\` users + P6_TEST_* courses before reseeding.
`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
