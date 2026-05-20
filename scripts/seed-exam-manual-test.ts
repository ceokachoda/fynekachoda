// Phase 7 — Manual-test fixture for graded exams.
//
// Creates:
//   - 1 course (P7_TEST_<ts>) with subject "Physics" + chapter "Mechanics"
//     + topic "Kinematics"
//   - 2 batches: A (test target — teacher + students A1/A2) and B
//     (cross-batch — student B1, NO teacher)
//   - 1 teacher (assigned to batch A only)
//   - 3 students: 2 in Batch A, 1 in Batch B
//   - 5 pre-built questions (each 4 options, 1 correct, with explanations)
//   - 3 exams:
//       Exam 1 ("Mechanics Live")     batch_A, starts 30s ago, 30 min,
//                                     published, MANUAL release, 5 Qs
//       Exam 2 ("Instant Reveal")     batch_A, starts 60s ago, 5 min,
//                                     published, INSTANT release, 2 Qs
//       Exam 3 ("Scheduled Tomorrow") batch_A, starts +24h, 60 min,
//                                     published, MANUAL release, 5 Qs
//   - 1 pre-existing offline test score for student A1
//
// Run:
//   pnpm seed:exam-manual-test          # creates fresh fixtures (idempotent ts in names)
//   pnpm seed:exam-manual-test --reset  # also wipes prior `p7-*` fixtures first
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
  h("Reset — wiping prior `p7-*` fixtures");
  const stale = await admin
    .from("app_users")
    .select("id, auth_user_id, email")
    .like("email", "p7-%")
    .limit(500);
  const ids = (stale.data ?? []).map((r) => r.id as string);
  const authIds = (stale.data ?? []).map((r) => r.auth_user_id as string);
  if (ids.length > 0) {
    const examAttempts = await admin.from("exam_attempts").select("id").in("student_id", ids);
    const attemptIds = (examAttempts.data ?? []).map((r: { id: string }) => r.id);
    if (attemptIds.length > 0) {
      await admin.from("exam_answers").delete().in("attempt_id", attemptIds);
    }
    await admin.from("exam_attempts").delete().in("student_id", ids);
    await admin.from("offline_test_scores").delete().in("student_id", ids);
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
    // after the course block removes the teacher's exams/quizzes/questions.
    // Those tables NO ACTION-reference app_users.id, so deleting identities
    // here would abort (and silently orphan the teachers/batch_teachers rows).
  }
  // Drop prior P7_TEST_* courses + their batches/exams/questions cascade.
  const oldCourses = await admin
    .from("courses")
    .select("id, code")
    .like("code", "P7_TEST_%");
  const oldCourseIds = (oldCourses.data ?? []).map((r: { id: string }) => r.id);
  if (oldCourseIds.length > 0) {
    const oldBatches = await admin
      .from("batches")
      .select("id")
      .in("course_id", oldCourseIds);
    const bIds = (oldBatches.data ?? []).map((r: { id: string }) => r.id);
    await admin.from("exams").delete().in("batch_id", bIds);
    await admin.from("quizzes").delete().in("course_id", oldCourseIds);
    await admin.from("content_items").delete().in("course_id", oldCourseIds);
    const topicQ = await admin
      .from("topics")
      .select("id, chapter_id, chapters!inner(subject_id, subjects!inner(course_id))")
      .in("chapters.subjects.course_id", oldCourseIds);
    const tIds = (topicQ.data ?? []).map((r: { id: string }) => r.id);
    if (tIds.length > 0) {
      await admin.from("questions").delete().in("topic_id", tIds);
    }
    await admin.from("batches").delete().in("id", bIds);
    await admin.from("courses").delete().in("id", oldCourseIds);
    info(`deleted ${oldCourseIds.length} prior P7_TEST_* courses (+ cascaded children)`);
  }

  // Now that course-owned exams/quizzes/questions are gone, the identities are
  // unreferenced. Delete per-id so one still-referenced row can't abort the
  // whole batch (which is what previously left orphaned p7-* teachers behind).
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
    info(`deleted ${deleted}/${ids.length} prior p7-* users`);
  }
}

async function main() {
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const ownerJwt = await signIn(OWNER_EMAIL, OWNER_PASSWORD);

  if (RESET) await resetPriorFixtures(admin);

  const ts = Date.now();
  const courseCode = `P7_TEST_${ts}`;

  h("Curriculum");
  const c = await callFn("curriculum-mutate", {
    op: "create_course", payload: { code: courseCode, name: `Phase 7 Test ${ts}` },
  }, ownerJwt);
  const courseId = (c.data.row as { id: string }).id;
  const s = await callFn("curriculum-mutate", {
    op: "create_subject", payload: { course_id: courseId, name: "Physics", sort_order: 0 },
  }, ownerJwt);
  const subjectId = (s.data.row as { id: string }).id;
  const ch = await callFn("curriculum-mutate", {
    op: "create_chapter", payload: { subject_id: subjectId, name: "Mechanics", sort_order: 0 },
  }, ownerJwt);
  const chapterId = (ch.data.row as { id: string }).id;
  const t = await callFn("curriculum-mutate", {
    op: "create_topic", payload: { chapter_id: chapterId, name: "Kinematics", sort_order: 0 },
  }, ownerJwt);
  const topicId = (t.data.row as { id: string }).id;
  info(`course=${courseId.slice(0, 8)}… topic=${topicId.slice(0, 8)}…`);

  h("Batches");
  const today = new Date().toISOString().slice(0, 10);
  const ba = await callFn("batch-mutate", {
    op: "create_batch",
    payload: { course_id: courseId, name: `P7_A_${ts}`, starts_on: today, capacity: 30 },
  }, ownerJwt);
  const batchAId = (ba.data.row as { id: string }).id;
  const bb = await callFn("batch-mutate", {
    op: "create_batch",
    payload: { course_id: courseId, name: `P7_B_${ts}`, starts_on: today, capacity: 30 },
  }, ownerJwt);
  const batchBId = (bb.data.row as { id: string }).id;
  info(`batch A=${batchAId.slice(0,8)}… B=${batchBId.slice(0,8)}…`);

  h("Users");
  const tcr = await callFn("auth-bootstrap", {
    role: "teacher",
    full_name: `P7 Teacher ${ts}`,
    email: `p7-teach-${ts}@fynestudy.example.com`,
    subjects: ["physics"],
  }, ownerJwt);
  const teacher = tcr.data as { user_id: string; auth_user_id: string; email: string; initial_password: string };
  await callFn("batch-mutate", { op: "assign_teacher", batch_id: batchAId, teacher_id: teacher.user_id }, ownerJwt);

  const stuA1r = await callFn("auth-bootstrap", {
    role: "student", full_name: `P7 Student A1 ${ts}`,
    email: `p7-stu-a1-${ts}@fynestudy.example.com`,
    parent_consent_method: "verbal", batch_id: batchAId,
  }, ownerJwt);
  const stuA2r = await callFn("auth-bootstrap", {
    role: "student", full_name: `P7 Student A2 ${ts}`,
    email: `p7-stu-a2-${ts}@fynestudy.example.com`,
    parent_consent_method: "verbal", batch_id: batchAId,
  }, ownerJwt);
  const stuB1r = await callFn("auth-bootstrap", {
    role: "student", full_name: `P7 Student B1 ${ts}`,
    email: `p7-stu-b1-${ts}@fynestudy.example.com`,
    parent_consent_method: "verbal", batch_id: batchBId,
  }, ownerJwt);
  const stuA1 = stuA1r.data as { user_id: string; auth_user_id: string; email: string; initial_password: string };
  const stuA2 = stuA2r.data as { user_id: string; auth_user_id: string; email: string; initial_password: string };
  const stuB1 = stuB1r.data as { user_id: string; auth_user_id: string; email: string; initial_password: string };

  await admin.from("app_users").update({ must_change_password: false })
    .in("id", [teacher.user_id, stuA1.user_id, stuA2.user_id, stuB1.user_id]);
  info(`teacher: ${teacher.email}`);
  info(`student A1: ${stuA1.email}`);
  info(`student A2: ${stuA2.email}`);
  info(`student B1: ${stuB1.email}`);

  h("Questions");
  async function makeQ(prompt: string, opts: { text: string; correct?: boolean }[], explanation: string) {
    const qi = await admin.from("questions").insert({
      topic_id: topicId, prompt_md: prompt,
      difficulty: "easy", created_by: teacher.user_id,
    }).select("id").single();
    if (qi.error || !qi.data) die(`question insert: ${qi.error?.message}`);
    const qid = qi.data.id;
    await admin.from("question_options").insert(
      opts.map((o, i) => ({
        question_id: qid, text_md: o.text, is_correct: !!o.correct, sort_order: i,
      })),
    );
    await admin.from("question_solutions").insert({
      question_id: qid, explanation_md: explanation, related_content_id: null,
    });
    return qid;
  }

  const q1 = await makeQ(
    "What is the SI unit of acceleration?",
    [
      { text: "m/s² (correct)", correct: true },
      { text: "m/s" },
      { text: "kg·m/s" },
      { text: "N·m" },
    ],
    "Acceleration is rate-of-change of velocity per unit time → m/s².",
  );
  const q2 = await makeQ(
    "A ball is dropped from rest. After 2 s of free fall (g = 10 m/s²), its speed is:",
    [
      { text: "5 m/s" },
      { text: "10 m/s" },
      { text: "20 m/s (correct)", correct: true },
      { text: "40 m/s" },
    ],
    "v = u + gt = 0 + 10×2 = 20 m/s.",
  );
  const q3 = await makeQ(
    "Which graph represents uniform velocity on a v-t plot?",
    [
      { text: "Straight horizontal line (correct)", correct: true },
      { text: "Parabola" },
      { text: "Sinusoidal" },
      { text: "Inverted parabola" },
    ],
    "Uniform velocity ⇒ constant v ⇒ horizontal line.",
  );
  const q4 = await makeQ(
    "If displacement is zero but distance is not, the body has:",
    [
      { text: "Stopped" },
      { text: "Moved in a straight line" },
      { text: "Returned to its starting point (correct)", correct: true },
      { text: "Reached escape velocity" },
    ],
    "Zero displacement with non-zero distance ⇒ returned to origin.",
  );
  const q5 = await makeQ(
    "A car travels 60 km north then 60 km south in 2 h. Its average velocity is:",
    [
      { text: "60 km/h" },
      { text: "30 km/h" },
      { text: "0 km/h (correct)", correct: true },
      { text: "120 km/h" },
    ],
    "Net displacement = 0, so avg velocity = 0.",
  );

  h("Exams");
  const startsLive = new Date(Date.now() - 30 * 1000).toISOString(); // 30s ago — live now
  const startsInstant = new Date(Date.now() - 60 * 1000).toISOString(); // 60s ago
  const startsFuture = new Date(Date.now() + 24 * 3600_000).toISOString();

  const exam1Ins = await admin.from("exams").insert({
    title: `Mechanics Live ${ts}`, batch_id: batchAId,
    starts_at: startsLive, duration_min: 30,
    marks_correct: 4, marks_wrong: -1, marks_skip: 0,
    randomize_questions: true, randomize_options: true,
    result_release: "manual", is_published: true,
    created_by: teacher.user_id,
  }).select("id").single();
  const exam1Id = exam1Ins.data!.id;
  await admin.from("exam_questions").insert([
    { exam_id: exam1Id, question_id: q1, sort_order: 0 },
    { exam_id: exam1Id, question_id: q2, sort_order: 1 },
    { exam_id: exam1Id, question_id: q3, sort_order: 2 },
    { exam_id: exam1Id, question_id: q4, sort_order: 3 },
    { exam_id: exam1Id, question_id: q5, sort_order: 4 },
  ]);

  const exam2Ins = await admin.from("exams").insert({
    title: `Instant Reveal ${ts}`, batch_id: batchAId,
    starts_at: startsInstant, duration_min: 5,
    marks_correct: 4, marks_wrong: -1, marks_skip: 0,
    randomize_questions: false, randomize_options: false,
    result_release: "instant", is_published: true,
    created_by: teacher.user_id,
  }).select("id").single();
  const exam2Id = exam2Ins.data!.id;
  await admin.from("exam_questions").insert([
    { exam_id: exam2Id, question_id: q1, sort_order: 0 },
    { exam_id: exam2Id, question_id: q5, sort_order: 1 },
  ]);

  const exam3Ins = await admin.from("exams").insert({
    title: `Scheduled Tomorrow ${ts}`, batch_id: batchAId,
    starts_at: startsFuture, duration_min: 60,
    marks_correct: 4, marks_wrong: -1, marks_skip: 0,
    randomize_questions: true, randomize_options: true,
    result_release: "manual", is_published: true,
    created_by: teacher.user_id,
  }).select("id").single();
  const exam3Id = exam3Ins.data!.id;
  await admin.from("exam_questions").insert([
    { exam_id: exam3Id, question_id: q1, sort_order: 0 },
    { exam_id: exam3Id, question_id: q2, sort_order: 1 },
    { exam_id: exam3Id, question_id: q3, sort_order: 2 },
    { exam_id: exam3Id, question_id: q4, sort_order: 3 },
    { exam_id: exam3Id, question_id: q5, sort_order: 4 },
  ]);

  h("One pre-existing offline test score (for student A1)");
  await admin.from("offline_test_scores").insert({
    batch_id: batchAId, student_id: stuA1.user_id, subject_id: null,
    test_name: `Weekly Paper Test ${ts}`,
    test_date: today, score: 72, max_score: 100,
    notes: "Good effort", entered_by: teacher.user_id,
  });

  h("Summary");
  console.log(`
Course:     ${courseCode}
Batch A:    ${batchAId}
Batch B:    ${batchBId}
Topic:      Kinematics (${topicId})

Teacher
  Email     ${teacher.email}
  Password  ${teacher.initial_password}

Student A1 (Batch A — sees Exam 1, 2, 3 + offline score)
  Email     ${stuA1.email}
  Password  ${stuA1.initial_password}

Student A2 (Batch A — same scope as A1)
  Email     ${stuA2.email}
  Password  ${stuA2.initial_password}

Student B1 (Batch B — sees NO exams from batch A)
  Email     ${stuB1.email}
  Password  ${stuB1.initial_password}

Exams:
  Exam 1    "Mechanics Live"      LIVE NOW         manual release  5 Qs  30 min  ${exam1Id}
  Exam 2    "Instant Reveal"      LIVE NOW         INSTANT reveal  2 Qs  5 min   ${exam2Id}
  Exam 3    "Scheduled Tomorrow"  STARTS +24h      manual release  5 Qs  60 min  ${exam3Id}

Owner-admin URL (for /exams + /offline-scores):
  https://admin-kohl-sigma.vercel.app/ (or pnpm dev:admin → localhost:3000)

All four accounts already have must_change_password=false. Re-run with
\`pnpm seed:exam-manual-test --reset\` to wipe prior p7-* users + P7_TEST_*
courses before reseeding.
`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
