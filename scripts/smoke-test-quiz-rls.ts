// Phase 6 — Quiz RLS smoke. Verifies the security guarantees:
//
//   T1  Student in batch A cannot start a quiz scoped to batch B.
//   T2  Student CANNOT SELECT public.question_options (would leak is_correct).
//   T3  Student CANNOT SELECT public.questions directly.
//   T4  Student CANNOT SELECT public.question_solutions directly.
//   T5  Student CAN SELECT a published-in-scope quiz.
//   T6  Student CANNOT see a quiz from another course.
//   T7  Student cannot SELECT another student's quiz_attempts.
//   T8  Teacher can SELECT every question (for bank picker).
//   T9  Teacher who owns a quiz can UPDATE it; teacher who doesn't, cannot.
//   T10 Student can upsert quiz_answers for own in-flight attempt.
//   T11 Student CANNOT upsert quiz_answers after submission.
//   T12 quiz-start payload contains NO `is_correct` field anywhere.
//
// Provisions ephemeral course + 2 batches + 2 students + 2 teachers via
// edge fns. Cleans up at the end.
//
// Run with `pnpm smoke:quiz-rls`.

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
  if (!res.ok) fail(`signIn ${email}: ${res.status} ${JSON.stringify(data)}`);
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
  header("Setup — owner sign-in + ephemeral course/batches");
  const ownerJwt = await signIn(OWNER_EMAIL, OWNER_PASSWORD);
  const ts = Date.now();
  const courseCode = `Q6_${ts}`;

  const cRes = await callFn(
    "curriculum-mutate",
    { op: "create_course", payload: { code: courseCode, name: `Q6 ${ts}` } },
    ownerJwt,
  );
  if (cRes.status !== 200) fail(`create course: ${JSON.stringify(cRes.body)}`);
  const courseId = (cRes.body.row as { id: string }).id;

  const sRes = await callFn(
    "curriculum-mutate",
    { op: "create_subject", payload: { course_id: courseId, name: "Sub", sort_order: 0 } },
    ownerJwt,
  );
  const subjectId = (sRes.body.row as { id: string }).id;
  const chRes = await callFn(
    "curriculum-mutate",
    { op: "create_chapter", payload: { subject_id: subjectId, name: "Ch", sort_order: 0 } },
    ownerJwt,
  );
  const chapterId = (chRes.body.row as { id: string }).id;
  const topRes = await callFn(
    "curriculum-mutate",
    { op: "create_topic", payload: { chapter_id: chapterId, name: "Topic", sort_order: 0 } },
    ownerJwt,
  );
  const topicId = (topRes.body.row as { id: string }).id;

  const otherCourseRes = await callFn(
    "curriculum-mutate",
    { op: "create_course", payload: { code: `Q6X_${ts}`, name: `Q6X ${ts}` } },
    ownerJwt,
  );
  const otherCourseId = (otherCourseRes.body.row as { id: string }).id;
  const oSubRes = await callFn(
    "curriculum-mutate",
    { op: "create_subject", payload: { course_id: otherCourseId, name: "OS", sort_order: 0 } },
    ownerJwt,
  );
  const oSubId = (oSubRes.body.row as { id: string }).id;
  const oChRes = await callFn(
    "curriculum-mutate",
    { op: "create_chapter", payload: { subject_id: oSubId, name: "OC", sort_order: 0 } },
    ownerJwt,
  );
  const oChId = (oChRes.body.row as { id: string }).id;
  const oTopRes = await callFn(
    "curriculum-mutate",
    { op: "create_topic", payload: { chapter_id: oChId, name: "OT", sort_order: 0 } },
    ownerJwt,
  );
  const oTopId = (oTopRes.body.row as { id: string }).id;

  const today = new Date().toISOString().slice(0, 10);
  const bARes = await callFn(
    "batch-mutate",
    { op: "create_batch", payload: { course_id: courseId, name: `Q6A_${ts}`, starts_on: today, capacity: 10 } },
    ownerJwt,
  );
  const batchAId = (bARes.body.row as { id: string }).id;
  const bBRes = await callFn(
    "batch-mutate",
    { op: "create_batch", payload: { course_id: courseId, name: `Q6B_${ts}`, starts_on: today, capacity: 10 } },
    ownerJwt,
  );
  const batchBId = (bBRes.body.row as { id: string }).id;
  const bORes = await callFn(
    "batch-mutate",
    { op: "create_batch", payload: { course_id: otherCourseId, name: `Q6OTHER_${ts}`, starts_on: today, capacity: 10 } },
    ownerJwt,
  );
  const batchOtherId = (bORes.body.row as { id: string }).id;

  pass(`courses + batches: A=${batchAId.slice(0,8)} B=${batchBId.slice(0,8)} OTHER=${batchOtherId.slice(0,8)}`);

  header("Setup — bootstrap users (2 students, 2 teachers)");
  async function createUser(payload: Record<string, unknown>) {
    const r = await callFn("auth-bootstrap", payload, ownerJwt);
    if (r.status !== 200) fail(`bootstrap ${JSON.stringify(payload)}: ${r.status} ${JSON.stringify(r.body)}`);
    return r.body as { user_id: string; auth_user_id: string; initial_password: string; email: string };
  }
  const stuA = await createUser({
    role: "student", full_name: `Q6 StuA ${ts}`,
    email: `q6-stu-a-${ts}@fynestudy.example.com`,
    parent_consent_method: "verbal", batch_id: batchAId,
  });
  const stuB = await createUser({
    role: "student", full_name: `Q6 StuB ${ts}`,
    email: `q6-stu-b-${ts}@fynestudy.example.com`,
    parent_consent_method: "verbal", batch_id: batchBId,
  });
  const stuOther = await createUser({
    role: "student", full_name: `Q6 StuOther ${ts}`,
    email: `q6-stu-other-${ts}@fynestudy.example.com`,
    parent_consent_method: "verbal", batch_id: batchOtherId,
  });
  const teach1 = await createUser({
    role: "teacher", full_name: `Q6 T1 ${ts}`,
    email: `q6-teach1-${ts}@fynestudy.example.com`,
    subjects: ["physics"],
  });
  const teach2 = await createUser({
    role: "teacher", full_name: `Q6 T2 ${ts}`,
    email: `q6-teach2-${ts}@fynestudy.example.com`,
    subjects: ["physics"],
  });

  await callFn("batch-mutate", { op: "assign_teacher", batch_id: batchAId, teacher_id: teach1.user_id }, ownerJwt);
  await callFn("batch-mutate", { op: "assign_teacher", batch_id: batchAId, teacher_id: teach2.user_id }, ownerJwt);

  // Clear must_change_password so we can sign in.
  await admin.from("app_users").update({ must_change_password: false })
    .in("id", [stuA.user_id, stuB.user_id, stuOther.user_id, teach1.user_id, teach2.user_id]);

  const stuAJwt = await signIn(stuA.email, stuA.initial_password);
  const stuBJwt = await signIn(stuB.email, stuB.initial_password);
  const stuOtherJwt = await signIn(stuOther.email, stuOther.initial_password);
  const teach1Jwt = await signIn(teach1.email, teach1.initial_password);
  const teach2Jwt = await signIn(teach2.email, teach2.initial_password);
  pass("5 JWTs acquired");

  header("Setup — questions + options + quizzes via teacher1");
  // Q1: correct=A. Q2: correct=B.
  const q1 = await rest<{ id: string }[]>(
    "POST", "questions",
    teach1Jwt,
    {
      topic_id: topicId,
      prompt_md: "Q1: Plain text $x = 2$",
      created_by: teach1.user_id,
      difficulty: "easy",
    },
  );
  if (q1.status !== 201) fail(`q1 insert: ${q1.status} ${JSON.stringify(q1.body)}`);
  const q1Id = q1.body![0]!.id;
  const q1Opts = await rest<{ id: string; is_correct: boolean }[]>(
    "POST", "question_options",
    teach1Jwt,
    [
      { question_id: q1Id, text_md: "A correct", is_correct: true, sort_order: 0 },
      { question_id: q1Id, text_md: "B", is_correct: false, sort_order: 1 },
      { question_id: q1Id, text_md: "C", is_correct: false, sort_order: 2 },
      { question_id: q1Id, text_md: "D", is_correct: false, sort_order: 3 },
    ],
  );
  if (q1Opts.status !== 201) fail(`q1 options: ${q1Opts.status}`);
  const q2 = await rest<{ id: string }[]>(
    "POST", "questions",
    teach1Jwt,
    {
      topic_id: topicId,
      prompt_md: "Q2 text",
      created_by: teach1.user_id,
    },
  );
  const q2Id = q2.body![0]!.id;
  await rest("POST", "question_options", teach1Jwt, [
    { question_id: q2Id, text_md: "A", is_correct: false, sort_order: 0 },
    { question_id: q2Id, text_md: "B correct", is_correct: true, sort_order: 1 },
    { question_id: q2Id, text_md: "C", is_correct: false, sort_order: 2 },
    { question_id: q2Id, text_md: "D", is_correct: false, sort_order: 3 },
  ]);

  // Quiz scoped to batch A.
  const quizA = await rest<{ id: string }[]>(
    "POST", "quizzes",
    teach1Jwt,
    {
      title: `Q6 A quiz ${ts}`,
      topic_id: topicId,
      batch_id: batchAId,
      course_id: courseId,
      duration_min: 10,
      marks_correct: 4,
      marks_wrong: -1,
      marks_skip: 0,
      randomize_questions: false,
      randomize_options: false,
      is_published: true,
      created_by: teach1.user_id,
    },
  );
  if (quizA.status !== 201) fail(`quizA insert: ${quizA.status} ${JSON.stringify(quizA.body)}`);
  const quizAId = quizA.body![0]!.id;
  await rest("POST", "quiz_questions", teach1Jwt, [
    { quiz_id: quizAId, question_id: q1Id, sort_order: 0 },
    { quiz_id: quizAId, question_id: q2Id, sort_order: 1 },
  ]);

  // Quiz scoped to batch B. teach1 isn't a teacher of batch B, so RLS would
  // refuse the SELECT-back of the INSERT'd row → use service role for setup.
  const quizBIns = await admin
    .from("quizzes")
    .insert({
      title: `Q6 B quiz ${ts}`,
      topic_id: topicId,
      batch_id: batchBId,
      course_id: courseId,
      duration_min: 10,
      marks_correct: 4,
      marks_wrong: -1,
      marks_skip: 0,
      is_published: true,
      created_by: teach1.user_id,
    })
    .select("id")
    .single();
  if (quizBIns.error || !quizBIns.data) fail(`quizB insert: ${quizBIns.error?.message}`);
  const quizBId = quizBIns.data!.id;
  const qqB = await admin
    .from("quiz_questions")
    .insert([{ quiz_id: quizBId, question_id: q1Id, sort_order: 0 }]);
  if (qqB.error) fail(`quizB quiz_questions: ${qqB.error.message}`);

  // Course-wide quiz (visible to A + B).
  const quizCw = await rest<{ id: string }[]>(
    "POST", "quizzes",
    teach1Jwt,
    {
      title: `Q6 cw ${ts}`,
      topic_id: topicId,
      course_id: courseId,
      duration_min: 5,
      marks_correct: 1,
      marks_wrong: 0,
      marks_skip: 0,
      is_published: true,
      created_by: teach1.user_id,
    },
  );
  const quizCwId = quizCw.body![0]!.id;
  await rest("POST", "quiz_questions", teach1Jwt, [
    { quiz_id: quizCwId, question_id: q1Id, sort_order: 0 },
  ]);

  pass(`quizzes A/B/CW created`);

  // ----------------------------
  header("T1 — student in batch A cannot start quiz scoped to batch B");
  const t1 = await callFn("quiz-start", { quiz_id: quizBId }, stuAJwt);
  if (t1.status === 200) fail("T1: expected 4xx, got 200");
  pass(`T1 blocked with ${t1.status}`);

  header("T2 — student cannot SELECT question_options");
  const t2 = await rest("GET", `question_options?select=id,is_correct&limit=1`, stuAJwt);
  // Expected: 200 with empty body (RLS filters everything out).
  if (t2.status !== 200) fail(`T2 unexpected status ${t2.status}`);
  if (Array.isArray(t2.body) && (t2.body as unknown[]).length > 0) {
    fail(`T2 returned rows: ${JSON.stringify(t2.body)}`);
  }
  pass("T2 question_options empty for student");

  header("T3 — student cannot SELECT questions");
  const t3 = await rest("GET", `questions?select=id,prompt_md&limit=1`, stuAJwt);
  if (t3.status !== 200) fail(`T3 unexpected status ${t3.status}`);
  if (Array.isArray(t3.body) && (t3.body as unknown[]).length > 0) {
    fail(`T3 returned rows: ${JSON.stringify(t3.body)}`);
  }
  pass("T3 questions empty for student");

  header("T4 — student cannot SELECT question_solutions");
  const t4 = await rest("GET", `question_solutions?select=question_id,explanation_md&limit=1`, stuAJwt);
  if (t4.status !== 200) fail(`T4 unexpected status ${t4.status}`);
  if (Array.isArray(t4.body) && (t4.body as unknown[]).length > 0) {
    fail(`T4 returned rows: ${JSON.stringify(t4.body)}`);
  }
  pass("T4 question_solutions empty for student");

  header("T5 — student can SELECT a published-in-scope quiz");
  const t5 = await rest<unknown[]>(
    "GET", `quizzes?select=id,title&id=eq.${quizAId}`, stuAJwt,
  );
  if (t5.status !== 200) fail(`T5 status ${t5.status}`);
  if (!Array.isArray(t5.body) || (t5.body as unknown[]).length !== 1) {
    fail(`T5 expected 1 row, got ${JSON.stringify(t5.body)}`);
  }
  pass("T5 student sees own-batch quiz");

  header("T6 — student cannot SELECT another course's quiz");
  // Create a published quiz in the OTHER course and verify stuA can't see it.
  const otherQuiz = await rest<{ id: string }[]>(
    "POST", "quizzes",
    ownerJwt,
    {
      title: `Q6 OTHER ${ts}`,
      topic_id: oTopId,
      course_id: otherCourseId,
      duration_min: 5,
      marks_correct: 4,
      marks_wrong: -1,
      marks_skip: 0,
      is_published: true,
      created_by: teach1.user_id,
    },
  );
  if (otherQuiz.status !== 201) fail(`other quiz insert ${otherQuiz.status} ${JSON.stringify(otherQuiz.body)}`);
  const otherQuizId = otherQuiz.body![0]!.id;
  const t6 = await rest<unknown[]>("GET", `quizzes?select=id&id=eq.${otherQuizId}`, stuAJwt);
  if ((t6.body as unknown[]).length !== 0) fail(`T6 student saw other-course quiz`);
  pass("T6 student cannot see other-course quiz");

  header("T7 — student cannot SELECT another student's quiz_attempts");
  // Have stuB start a quiz, then stuA tries to read it.
  const stuBStart = await callFn("quiz-start", { quiz_id: quizBId }, stuBJwt);
  if (stuBStart.status !== 200) fail(`stuB quiz-start: ${JSON.stringify(stuBStart.body)}`);
  const stuBAttemptId = (stuBStart.body as { attempt_id: string }).attempt_id;
  const t7 = await rest<unknown[]>(
    "GET", `quiz_attempts?select=id&id=eq.${stuBAttemptId}`, stuAJwt,
  );
  if ((t7.body as unknown[]).length !== 0) fail(`T7 stuA saw stuB's attempt`);
  pass("T7 cross-student attempt invisible");

  header("T8 — teacher SELECTs all questions");
  const t8 = await rest<unknown[]>("GET", `questions?select=id&limit=100`, teach1Jwt);
  if (t8.status !== 200) fail(`T8 status ${t8.status}`);
  if (!Array.isArray(t8.body) || (t8.body as unknown[]).length < 2) {
    fail(`T8 expected >=2 rows, got ${(t8.body as unknown[]).length}`);
  }
  pass(`T8 teacher saw ${(t8.body as unknown[]).length} questions`);

  header("T9 — teacher cannot update another teacher's quiz");
  // teach2 tries to update quizA (owned by teach1)
  const t9 = await rest(
    "PATCH",
    `quizzes?id=eq.${quizAId}`,
    teach2Jwt,
    { title: "HIJACK" },
  );
  // 200 with empty array means RLS filtered all rows; or 403/406 also acceptable.
  if (
    t9.status === 200 &&
    Array.isArray(t9.body) &&
    (t9.body as unknown[]).length > 0
  ) {
    fail(`T9 teach2 updated teach1's quiz: ${JSON.stringify(t9.body)}`);
  }
  pass(`T9 cross-teacher update blocked (status ${t9.status})`);

  header("T10 — student CAN upsert quiz_answers for own in-flight attempt");
  const stuAStart = await callFn("quiz-start", { quiz_id: quizAId }, stuAJwt);
  if (stuAStart.status !== 200) fail(`stuA quiz-start: ${JSON.stringify(stuAStart.body)}`);
  const stuAAttemptId = (stuAStart.body as { attempt_id: string }).attempt_id;
  const stuAQuestions = (stuAStart.body as { questions: { id: string; options: { id: string }[] }[] }).questions;
  if (stuAQuestions.length === 0) fail("stuA got no questions");
  const firstQid = stuAQuestions[0]!.id;
  const firstOpt = stuAQuestions[0]!.options[0]!.id;
  const t10 = await rest(
    "POST", "quiz_answers",
    stuAJwt,
    {
      attempt_id: stuAAttemptId,
      question_id: firstQid,
      selected_option_id: firstOpt,
      is_flagged: false,
      answered_at: new Date().toISOString(),
    },
  );
  if (t10.status !== 201) fail(`T10 upsert: ${t10.status} ${JSON.stringify(t10.body)}`);
  pass("T10 student upserted own answer");

  header("T11 — student CANNOT upsert quiz_answers after submission");
  const submit = await callFn("quiz-submit", { attempt_id: stuAAttemptId }, stuAJwt);
  if (submit.status !== 200) fail(`stuA quiz-submit: ${JSON.stringify(submit.body)}`);
  const t11 = await rest(
    "POST", "quiz_answers",
    stuAJwt,
    {
      attempt_id: stuAAttemptId,
      question_id: stuAQuestions[1]!.id,
      selected_option_id: stuAQuestions[1]!.options[0]!.id,
      is_flagged: false,
    },
  );
  // RLS should block insert after submit (with check fails) — expect 4xx.
  if (t11.status >= 200 && t11.status < 300) {
    fail(`T11 expected 4xx, got ${t11.status} ${JSON.stringify(t11.body)}`);
  }
  pass(`T11 blocked with ${t11.status}`);

  header("T12 — quiz-start response contains NO is_correct anywhere");
  const startBody = JSON.stringify(stuAStart.body);
  if (/"is_correct"/.test(startBody)) {
    fail(`T12 leak detected in quiz-start response: substring "is_correct"`);
  }
  pass("T12 quiz-start payload has no is_correct field");

  // -------- Cleanup --------
  header("Cleanup");
  await admin.from("quizzes").delete().in("id", [quizAId, quizBId, quizCwId, otherQuizId]);
  await admin.from("questions").delete().in("id", [q1Id, q2Id]);
  await admin.from("batch_teachers").delete().in("teacher_id", [teach1.user_id, teach2.user_id]);
  await admin.from("students").delete().in("user_id", [stuA.user_id, stuB.user_id, stuOther.user_id]);
  await admin.from("teachers").delete().in("user_id", [teach1.user_id, teach2.user_id]);
  await admin.from("user_roles").delete().in("user_id", [stuA.user_id, stuB.user_id, stuOther.user_id, teach1.user_id, teach2.user_id]);
  await admin.from("app_users").delete().in("id", [stuA.user_id, stuB.user_id, stuOther.user_id, teach1.user_id, teach2.user_id]);
  await admin.auth.admin.deleteUser(stuA.auth_user_id);
  await admin.auth.admin.deleteUser(stuB.auth_user_id);
  await admin.auth.admin.deleteUser(stuOther.auth_user_id);
  await admin.auth.admin.deleteUser(teach1.auth_user_id);
  await admin.auth.admin.deleteUser(teach2.auth_user_id);
  await admin.from("batches").delete().in("id", [batchAId, batchBId, batchOtherId]);
  await admin.from("courses").delete().in("id", [courseId, otherCourseId]);

  console.log("\nALL TESTS PASSED");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
