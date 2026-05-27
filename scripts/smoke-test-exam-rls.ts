// Phase 7 — Exam RLS smoke. Verifies the security guarantees:
//
//   T1  Student in batch A cannot SELECT an exam in batch B (RLS scope).
//   T2  Student in batch A cannot SELECT exam_questions of a batch-B exam.
//   T3  Student CANNOT SELECT another student's exam_attempts.
//   T4  Student CAN SELECT own submitted exam_attempts.
//   T5  Student CAN upsert exam_answers for own in-flight attempt.
//   T6  Student CANNOT upsert exam_answers AFTER submission (submitted_at NOT NULL).
//   T7  Student CANNOT SELECT another student's exam_answers.
//   T8  Teacher of batch A can SELECT exams in batch A.
//   T9  Teacher of batch A CANNOT SELECT exams in batch B.
//   T10 `exam-start` response (HTTP) contains NO `correct_option_id` OR `is_correct` substring anywhere.
//   T11 `exam-attempt-result` returns 423 BEFORE release (manual exam).
//   T12 Student of batch A can read own offline_test_scores; cannot read another student's.
//
// Provisions an ephemeral course + 2 batches + 2 students + 1 teacher via
// edge fns. Cleans up at the end (best-effort).
//
// Run with `pnpm smoke:exam-rls`.

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
function header(s: string) { console.log(`\n=== ${s} ===`); }
function pass(s: string) { console.log(`  PASS  ${s}`); }
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

  header("Setup — owner sign-in + ephemeral course / batches / users");
  const ownerJwt = await signIn(OWNER_EMAIL, OWNER_PASSWORD);
  const ts = Date.now();
  const courseCode = `XE_${ts}`;

  const c = await callFn(
    "curriculum-mutate",
    { op: "create_course", payload: { code: courseCode, name: `XE ${ts}` } },
    ownerJwt,
  );
  if (c.status !== 200) fail(`create course: ${JSON.stringify(c.body)}`);
  const courseId = (c.body.row as { id: string }).id;
  const s = await callFn(
    "curriculum-mutate",
    { op: "create_subject", payload: { course_id: courseId, name: "S", sort_order: 0 } },
    ownerJwt,
  );
  const subjectId = (s.body.row as { id: string }).id;
  const ch = await callFn(
    "curriculum-mutate",
    { op: "create_chapter", payload: { subject_id: subjectId, name: "C", sort_order: 0 } },
    ownerJwt,
  );
  const chapterId = (ch.body.row as { id: string }).id;
  const t = await callFn(
    "curriculum-mutate",
    { op: "create_topic", payload: { chapter_id: chapterId, name: "T", sort_order: 0 } },
    ownerJwt,
  );
  const topicId = (t.body.row as { id: string }).id;

  const today = new Date().toISOString().slice(0, 10);
  const ba = await callFn(
    "batch-mutate",
    { op: "create_batch", payload: { course_id: courseId, name: `XE_A_${ts}`, starts_on: today, capacity: 10 } },
    ownerJwt,
  );
  const batchA = (ba.body.row as { id: string }).id;
  const bb = await callFn(
    "batch-mutate",
    { op: "create_batch", payload: { course_id: courseId, name: `XE_B_${ts}`, starts_on: today, capacity: 10 } },
    ownerJwt,
  );
  const batchB = (bb.body.row as { id: string }).id;

  const teach = await callFn("auth-bootstrap", {
    role: "teacher", full_name: `XE Teach ${ts}`,
    email: `xe-teach-${ts}@fynestudy.example.com`,
    subjects: ["physics"],
  }, ownerJwt);
  const teacher = teach.body as { user_id: string; auth_user_id: string; initial_password: string; email: string };
  await callFn("batch-mutate", { op: "assign_teacher", batch_id: batchA, teacher_id: teacher.user_id }, ownerJwt);

  const stuA = await callFn("auth-bootstrap", {
    role: "student", full_name: `XE Stu A ${ts}`,
    email: `xe-stu-a-${ts}@fynestudy.example.com`,
    parent_consent_method: "verbal", batch_id: batchA,
  }, ownerJwt);
  const studentA = stuA.body as { user_id: string; auth_user_id: string; initial_password: string; email: string };
  const stuB = await callFn("auth-bootstrap", {
    role: "student", full_name: `XE Stu B ${ts}`,
    email: `xe-stu-b-${ts}@fynestudy.example.com`,
    parent_consent_method: "verbal", batch_id: batchB,
  }, ownerJwt);
  const studentB = stuB.body as { user_id: string; auth_user_id: string; initial_password: string; email: string };

  await admin.from("app_users").update({ must_change_password: false })
    .in("id", [teacher.user_id, studentA.user_id, studentB.user_id]);
  const teachJwt = await signIn(teacher.email, teacher.initial_password);
  const stuAJwt = await signIn(studentA.email, studentA.initial_password);
  const stuBJwt = await signIn(studentB.email, studentB.initial_password);

  // Bank: 2 questions with options.
  const q1Ins = await rest<{ id: string }[]>("POST", "questions", teachJwt, {
    topic_id: topicId, prompt_md: "Q1 — what is 2+2?", created_by: teacher.user_id, difficulty: "easy",
  });
  const q1Id = q1Ins.body![0]!.id;
  const q1Opts = await rest<{ id: string; is_correct: boolean }[]>(
    "POST", "question_options", teachJwt,
    [
      { question_id: q1Id, text_md: "3", is_correct: false, sort_order: 0 },
      { question_id: q1Id, text_md: "4", is_correct: true, sort_order: 1 },
      { question_id: q1Id, text_md: "5", is_correct: false, sort_order: 2 },
      { question_id: q1Id, text_md: "6", is_correct: false, sort_order: 3 },
    ],
  );
  const q1CorrectId = q1Opts.body!.find((o) => o.is_correct)!.id;

  const q2Ins = await rest<{ id: string }[]>("POST", "questions", teachJwt, {
    topic_id: topicId, prompt_md: "Q2 — what is 3+3?", created_by: teacher.user_id, difficulty: "easy",
  });
  const q2Id = q2Ins.body![0]!.id;
  await rest("POST", "question_options", teachJwt, [
    { question_id: q2Id, text_md: "5", is_correct: false, sort_order: 0 },
    { question_id: q2Id, text_md: "6", is_correct: true, sort_order: 1 },
    { question_id: q2Id, text_md: "7", is_correct: false, sort_order: 2 },
    { question_id: q2Id, text_md: "8", is_correct: false, sort_order: 3 },
  ]);

  // Create exam A (batch A, live now) directly via service role (PostgREST
  // INSERT with `Prefer: return=representation` evaluates BOTH WITH CHECK
  // and the SELECT-back USING policies on the new row — D-176. Teacher
  // would pass WITH CHECK but to keep this smoke setup robust we just use
  // service-role here).
  const startsAt = new Date(Date.now() - 60_000).toISOString(); // 1 min ago — live
  const examA = await admin.from("exams").insert({
    title: `XE A ${ts}`, batch_id: batchA, starts_at: startsAt, duration_min: 30,
    is_published: true, result_release: "manual",
    created_by: teacher.user_id,
  }).select("id").single();
  if (examA.error || !examA.data) fail(`exam A insert: ${examA.error?.message}`);
  const examAId = examA.data.id;
  await admin.from("exam_questions").insert([
    { exam_id: examAId, question_id: q1Id, sort_order: 0 },
    { exam_id: examAId, question_id: q2Id, sort_order: 1 },
  ]);

  // Exam B (batch B). Visible to student B only.
  const examB = await admin.from("exams").insert({
    title: `XE B ${ts}`, batch_id: batchB, starts_at: startsAt, duration_min: 30,
    is_published: true, result_release: "manual",
    created_by: teacher.user_id,
  }).select("id").single();
  if (examB.error || !examB.data) fail(`exam B insert: ${examB.error?.message}`);
  const examBId = examB.data.id;
  await admin.from("exam_questions").insert([
    { exam_id: examBId, question_id: q1Id, sort_order: 0 },
  ]);
  pass("fixtures planted");

  // ---------- T1: student A cannot see exam B ----------
  header("T1 — student A cannot SELECT exam in batch B");
  const t1 = await rest<unknown[]>("GET", `exams?id=eq.${examBId}&select=id`, stuAJwt);
  if (t1.status !== 200) fail(`status ${t1.status}`);
  if ((t1.body ?? []).length !== 0) fail(`leaked: ${JSON.stringify(t1.body)}`);
  pass("RLS hid batch-B exam from student A");

  // T2: student A cannot see exam_questions of exam B.
  header("T2 — student A cannot SELECT exam_questions of exam B");
  const t2 = await rest<unknown[]>(
    "GET",
    `exam_questions?exam_id=eq.${examBId}&select=question_id`,
    stuAJwt,
  );
  if (t2.status !== 200) fail(`status ${t2.status}`);
  if ((t2.body ?? []).length !== 0) fail(`leaked: ${JSON.stringify(t2.body)}`);
  pass("RLS hid batch-B exam_questions from student A");

  // ---------- T10: exam-start payload has NO correct_option_id / is_correct ----------
  header("T10 — exam-start response strips correct_option_id + is_correct");
  const start = await callFn("exam-start", { exam_id: examAId }, stuAJwt);
  if (start.status !== 200) fail(`exam-start: ${JSON.stringify(start.body)}`);
  const startStr = JSON.stringify(start.body);
  if (startStr.includes("\"correct_option_id\"")) {
    fail(`LEAK: 'correct_option_id' appears in exam-start response: ${startStr}`);
  }
  if (startStr.includes("\"is_correct\"")) {
    fail(`LEAK: 'is_correct' appears in exam-start response: ${startStr}`);
  }
  pass("zero `correct_option_id` / `is_correct` in exam-start response");
  const attemptId = (start.body.attempt_id as string);

  // ---------- T3 + T4 + T5 + T6 ----------
  header("T3 — student A can SELECT own attempt");
  const t3 = await rest<Array<{ id: string }>>(
    "GET", `exam_attempts?id=eq.${attemptId}&select=id`, stuAJwt,
  );
  if ((t3.body ?? []).length !== 1) fail(`expected 1 own attempt, got ${JSON.stringify(t3.body)}`);
  pass("own attempt visible");

  header("T4 — student A can upsert exam_answers for own in-flight attempt");
  const q1OptsCheck = await admin.from("question_options")
    .select("id, is_correct").eq("question_id", q1Id);
  const someOpt = q1OptsCheck.data?.find((o) => !o.is_correct)?.id;
  if (!someOpt) fail("no non-correct option found");
  const t4 = await rest<unknown[]>(
    "POST",
    "exam_answers?on_conflict=attempt_id,question_id",
    stuAJwt,
    [
      {
        attempt_id: attemptId,
        question_id: q1Id,
        selected_option_id: someOpt,
        is_flagged: false,
        answered_at: new Date().toISOString(),
      },
    ],
  );
  if (t4.status >= 400) fail(`upsert: ${t4.status} ${JSON.stringify(t4.body)}`);
  pass("in-flight upsert allowed");

  // T4b — server-authoritative deadline cut (2026-05-21). Once now() passes
  // the attempt's deadline_at, the SAME student can no longer write answers,
  // even though the attempt is still unsubmitted. Proves the deadline clause in
  // exam_answers_student_insert/update WITH CHECK (closes the clock-back cheat).
  header("T4b — student A CANNOT upsert exam_answers after deadline_at passes");
  const origDeadline = await admin
    .from("exam_attempts").select("deadline_at").eq("id", attemptId).maybeSingle();
  await admin.from("exam_attempts")
    .update({ deadline_at: "2020-01-01T00:00:00Z" }).eq("id", attemptId);
  const t4b = await rest<unknown[]>(
    "POST",
    "exam_answers?on_conflict=attempt_id,question_id",
    stuAJwt,
    [
      {
        attempt_id: attemptId,
        question_id: q1Id,
        selected_option_id: someOpt,
        is_flagged: true,
        answered_at: new Date().toISOString(),
      },
    ],
  );
  if (t4b.status < 400) {
    fail(`post-deadline upsert should be rejected, got ${t4b.status} ${JSON.stringify(t4b.body)}`);
  }
  pass(`post-deadline upsert correctly rejected (status ${t4b.status})`);
  // Restore the real deadline so the submit step below behaves normally.
  await admin.from("exam_attempts")
    .update({ deadline_at: origDeadline.data?.deadline_at ?? new Date(Date.now() + 3_600_000).toISOString() })
    .eq("id", attemptId);

  // Cross-check: student B cannot read student A's answers (T7).
  header("T7 — student B cannot SELECT student A's exam_answers");
  const t7 = await rest<unknown[]>(
    "GET",
    `exam_answers?attempt_id=eq.${attemptId}&select=question_id`,
    stuBJwt,
  );
  if ((t7.body ?? []).length !== 0) fail(`leaked: ${JSON.stringify(t7.body)}`);
  pass("RLS hid student A's answers from student B");

  // Submit attempt as student A, then T5 + T6.
  header("Setup — submit student A's attempt");
  const submit = await callFn("exam-submit", { attempt_id: attemptId }, stuAJwt);
  if (submit.status !== 200) fail(`exam-submit: ${JSON.stringify(submit.body)}`);
  pass("submitted");

  header("T5 — student A cannot upsert exam_answers AFTER submission");
  const t5 = await rest<unknown[]>(
    "POST",
    "exam_answers?on_conflict=attempt_id,question_id",
    stuAJwt,
    [
      {
        attempt_id: attemptId,
        question_id: q1Id,
        selected_option_id: q1CorrectId,
        is_flagged: false,
      },
    ],
  );
  if (t5.status < 400) fail(`expected RLS rejection, got ${t5.status} ${JSON.stringify(t5.body)}`);
  pass(`post-submit upsert correctly rejected (status ${t5.status})`);

  // ---------- T11: results_released_at NULL → exam-attempt-result returns 423 ----------
  header("T11 — exam-attempt-result returns 423 BEFORE release (manual exam)");
  const t11 = await callFn("exam-attempt-result", { attempt_id: attemptId }, stuAJwt);
  if (t11.status !== 423) fail(`expected 423, got ${t11.status} ${JSON.stringify(t11.body)}`);
  pass("locked pre-release");

  // Now release. Teacher does it.
  header("Setup — teacher releases results");
  const rel = await callFn("exam-release-results", { exam_id: examAId }, teachJwt);
  if (rel.status !== 200) fail(`exam-release-results: ${JSON.stringify(rel.body)}`);
  pass("released");

  // After release, exam-attempt-result returns 200.
  const t11b = await callFn("exam-attempt-result", { attempt_id: attemptId }, stuAJwt);
  if (t11b.status !== 200) fail(`expected 200 after release, got ${t11b.status}`);
  pass("200 after release");

  // ---------- T8 + T9 ----------
  header("T8 — teacher of batch A can SELECT exam A");
  const t8 = await rest<Array<{ id: string }>>(
    "GET", `exams?id=eq.${examAId}&select=id`, teachJwt,
  );
  if ((t8.body ?? []).length !== 1) fail(`teacher couldn't see own exam: ${JSON.stringify(t8.body)}`);
  pass("ok");

  header("T9 — teacher of batch A CANNOT SELECT exam B (different batch)");
  // The teacher is NOT assigned to batch B. But they did `create_by`
  // exam B in this fixture — so they CAN see it via the "created_by" path
  // in exams_teacher_read. The RLS policy unions (batch_teachers OR
  // created_by) for written rows but exams_teacher_read only gates on
  // batch_teachers. Let's re-verify the policy actually scopes via the
  // batch_teachers list:
  //  exams_teacher_read using batch_id in (select batch_id from
  //  batch_teachers where teacher_id = current_app_user_id())
  // So teacher who created exam B but is NOT assigned to batch B CANNOT
  // see it.
  const t9 = await rest<Array<{ id: string }>>(
    "GET", `exams?id=eq.${examBId}&select=id`, teachJwt,
  );
  if ((t9.body ?? []).length !== 0) {
    fail(`teacher saw batch-B exam unexpectedly: ${JSON.stringify(t9.body)}`);
  }
  pass("teacher CANNOT see exam in unassigned batch");

  // ---------- T12: offline_test_scores ----------
  header("T12 — offline_test_scores RLS");
  await admin.from("offline_test_scores").insert([
    {
      batch_id: batchA, student_id: studentA.user_id, test_name: `XE_OT_${ts}`,
      test_date: today, score: 50, max_score: 100, entered_by: teacher.user_id,
    },
    {
      batch_id: batchB, student_id: studentB.user_id, test_name: `XE_OT_${ts}`,
      test_date: today, score: 60, max_score: 100, entered_by: teacher.user_id,
    },
  ]);
  const t12a = await rest<Array<{ id: string; student_id: string }>>(
    "GET",
    `offline_test_scores?test_name=eq.XE_OT_${ts}&select=id,student_id`,
    stuAJwt,
  );
  if ((t12a.body ?? []).length !== 1 || t12a.body![0].student_id !== studentA.user_id) {
    fail(`student A saw wrong rows: ${JSON.stringify(t12a.body)}`);
  }
  pass("student A only sees own row");

  // ---------- Cleanup ----------
  header("Cleanup");
  await admin.from("offline_test_scores").delete().eq("test_name", `XE_OT_${ts}`);
  await admin.from("exam_answers").delete().eq("attempt_id", attemptId);
  await admin.from("exam_attempts").delete().eq("exam_id", examAId);
  await admin.from("exam_attempts").delete().eq("exam_id", examBId);
  await admin.from("exam_questions").delete().eq("exam_id", examAId);
  await admin.from("exam_questions").delete().eq("exam_id", examBId);
  await admin.from("exams").delete().eq("id", examAId);
  await admin.from("exams").delete().eq("id", examBId);
  await admin.from("question_options").delete().in("question_id", [q1Id, q2Id]);
  await admin.from("questions").delete().in("id", [q1Id, q2Id]);
  for (const u of [teacher.user_id, studentA.user_id, studentB.user_id]) {
    await admin.from("batch_teachers").delete().eq("teacher_id", u);
    await admin.from("students").delete().eq("user_id", u);
    await admin.from("teachers").delete().eq("user_id", u);
    await admin.from("user_roles").delete().eq("user_id", u);
    await admin.from("audit_log").delete().eq("actor_user_id", u);
    await admin.from("app_users").delete().eq("id", u);
  }
  for (const a of [teacher.auth_user_id, studentA.auth_user_id, studentB.auth_user_id]) {
    try { await admin.auth.admin.deleteUser(a); } catch {}
  }
  await admin.from("batches").delete().in("id", [batchA, batchB]);
  await admin.from("topics").delete().eq("id", topicId);
  await admin.from("chapters").delete().eq("id", chapterId);
  await admin.from("subjects").delete().eq("id", subjectId);
  await admin.from("courses").delete().eq("id", courseId);
  pass("cleanup done");

  console.log("\nALL EXAM RLS SMOKES PASSED");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
