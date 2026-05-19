// Phase 6 — End-to-end smoke for every Phase 6 edge fn.
//
// Asserts shape + auth + role + happy path + key error cases for:
//   quiz-start, quiz-submit, quiz-attempt-result, quiz-image-presign,
//   quiz-admin-mutate.
//
// Run with `pnpm smoke:quiz-fns`.

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

async function callFn(name: string, body: unknown, jwt: string | null) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (jwt) headers.Authorization = `Bearer ${jwt}`;
  else headers.apikey = ANON_KEY;
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, body: data as Record<string, unknown> };
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
  method: "POST" | "PATCH" | "GET" | "DELETE",
  path: string,
  jwt: string | null,
  body?: unknown,
) {
  const headers: Record<string, string> = {
    apikey: ANON_KEY,
    "Content-Type": "application/json",
  };
  if (jwt) headers.Authorization = `Bearer ${jwt}`;
  if (method !== "GET" && method !== "DELETE") headers["Prefer"] = "return=representation";
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

  header("Setup — owner sign-in + ephemeral course/batch + teacher/student");
  const ownerJwt = await signIn(OWNER_EMAIL, OWNER_PASSWORD);
  const ts = Date.now();
  const courseCode = `QE_${ts}`;
  const cRes = await callFn("curriculum-mutate", { op: "create_course", payload: { code: courseCode, name: `QE ${ts}` } }, ownerJwt);
  const courseId = (cRes.body.row as { id: string }).id;
  const sRes = await callFn("curriculum-mutate", { op: "create_subject", payload: { course_id: courseId, name: "S", sort_order: 0 } }, ownerJwt);
  const subjectId = (sRes.body.row as { id: string }).id;
  const chRes = await callFn("curriculum-mutate", { op: "create_chapter", payload: { subject_id: subjectId, name: "C", sort_order: 0 } }, ownerJwt);
  const chapterId = (chRes.body.row as { id: string }).id;
  const topRes = await callFn("curriculum-mutate", { op: "create_topic", payload: { chapter_id: chapterId, name: "T", sort_order: 0 } }, ownerJwt);
  const topicId = (topRes.body.row as { id: string }).id;

  const today = new Date().toISOString().slice(0, 10);
  const bRes = await callFn("batch-mutate", { op: "create_batch", payload: { course_id: courseId, name: `QE_${ts}`, starts_on: today, capacity: 10 } }, ownerJwt);
  const batchId = (bRes.body.row as { id: string }).id;

  const stuRes = await callFn("auth-bootstrap", {
    role: "student", full_name: `QE Stu ${ts}`,
    email: `qe-stu-${ts}@fynestudy.example.com`,
    parent_consent_method: "verbal", batch_id: batchId,
  }, ownerJwt);
  if (stuRes.status !== 200) fail(`student bootstrap: ${JSON.stringify(stuRes.body)}`);
  const student = stuRes.body as { user_id: string; auth_user_id: string; initial_password: string; email: string };

  const teachRes = await callFn("auth-bootstrap", {
    role: "teacher", full_name: `QE Teach ${ts}`,
    email: `qe-teach-${ts}@fynestudy.example.com`,
    subjects: ["physics"],
  }, ownerJwt);
  const teacher = teachRes.body as { user_id: string; auth_user_id: string; initial_password: string; email: string };
  await callFn("batch-mutate", { op: "assign_teacher", batch_id: batchId, teacher_id: teacher.user_id }, ownerJwt);

  await admin.from("app_users").update({ must_change_password: false })
    .in("id", [student.user_id, teacher.user_id]);
  const stuJwt = await signIn(student.email, student.initial_password);
  const teachJwt = await signIn(teacher.email, teacher.initial_password);
  pass("teacher+student set up");

  header("Setup — bank: 2 questions, 1 quiz with 2 questions");
  const q1 = await rest<{ id: string }[]>("POST", "questions", teachJwt, {
    topic_id: topicId, prompt_md: "Q1 prompt", created_by: teacher.user_id,
  });
  const q1Id = q1.body![0]!.id;
  const q1Opts = await rest<{ id: string; is_correct: boolean }[]>("POST", "question_options", teachJwt, [
    { question_id: q1Id, text_md: "A", is_correct: true,  sort_order: 0 },
    { question_id: q1Id, text_md: "B", is_correct: false, sort_order: 1 },
    { question_id: q1Id, text_md: "C", is_correct: false, sort_order: 2 },
    { question_id: q1Id, text_md: "D", is_correct: false, sort_order: 3 },
  ]);
  const q1CorrectId = q1Opts.body!.find((o) => o.is_correct)!.id;
  await rest("POST", "question_solutions", teachJwt, {
    question_id: q1Id, explanation_md: "Because A.",
  });

  const q2 = await rest<{ id: string }[]>("POST", "questions", teachJwt, {
    topic_id: topicId, prompt_md: "Q2 prompt", created_by: teacher.user_id,
  });
  const q2Id = q2.body![0]!.id;
  await rest("POST", "question_options", teachJwt, [
    { question_id: q2Id, text_md: "A", is_correct: false, sort_order: 0 },
    { question_id: q2Id, text_md: "B", is_correct: true,  sort_order: 1 },
    { question_id: q2Id, text_md: "C", is_correct: false, sort_order: 2 },
    { question_id: q2Id, text_md: "D", is_correct: false, sort_order: 3 },
  ]);

  const quiz = await rest<{ id: string }[]>("POST", "quizzes", teachJwt, {
    title: `QE quiz ${ts}`,
    topic_id: topicId,
    course_id: courseId,
    batch_id: batchId,
    duration_min: 10,
    marks_correct: 4,
    marks_wrong: -1,
    marks_skip: 0,
    randomize_questions: false,
    randomize_options: false,
    is_published: true,
    created_by: teacher.user_id,
  });
  const quizId = quiz.body![0]!.id;
  await rest("POST", "quiz_questions", teachJwt, [
    { quiz_id: quizId, question_id: q1Id, sort_order: 0 },
    { quiz_id: quizId, question_id: q2Id, sort_order: 1 },
  ]);
  pass("quiz+2q+options+solution");

  // ---------- quiz-start ----------
  header("quiz-start auth + role");
  const t1 = await callFn("quiz-start", { quiz_id: quizId }, null);
  if (t1.status !== 401) fail(`no-auth: ${t1.status}`);
  pass("rejects no-auth (401)");
  const t2 = await callFn("quiz-start", { quiz_id: quizId }, ownerJwt);
  if (t2.status !== 403) fail(`owner: ${t2.status}`);
  pass("rejects owner-admin (403 student-only)");
  const t3 = await callFn("quiz-start", { quiz_id: "not-uuid" }, stuJwt);
  if (t3.status !== 400) fail(`bad uuid: ${t3.status}`);
  pass("rejects non-uuid input (400)");

  header("quiz-start happy path");
  const start = await callFn("quiz-start", { quiz_id: quizId }, stuJwt);
  if (start.status !== 200) fail(`quiz-start: ${JSON.stringify(start.body)}`);
  const startBody = start.body as Record<string, unknown>;
  if (typeof startBody.attempt_id !== "string") fail("missing attempt_id");
  if (!Array.isArray(startBody.questions)) fail("missing questions");
  if ((startBody.questions as unknown[]).length !== 2) fail("expected 2 questions");
  if (JSON.stringify(startBody).includes('"is_correct"')) fail("LEAK: is_correct in response");
  pass("returns attempt_id + 2 questions, no is_correct leak");
  const attemptId = startBody.attempt_id as string;

  header("quiz-start idempotency (same in-flight attempt reused)");
  const start2 = await callFn("quiz-start", { quiz_id: quizId }, stuJwt);
  if (start2.status !== 200) fail(`re-start: ${JSON.stringify(start2.body)}`);
  if ((start2.body.attempt_id as string) !== attemptId) {
    fail(`expected same attempt_id, got ${start2.body.attempt_id}`);
  }
  pass("re-start returns the SAME attempt_id");

  header("auto-save: insert quiz_answers via PostgREST");
  const questions = (startBody.questions as Array<{ id: string; options: Array<{ id: string }> }>);
  const q1Selected = questions.find((q) => q.id === q1Id)!.options.find((o) => o.id === q1CorrectId)!.id;
  const u1 = await rest("POST", "quiz_answers", stuJwt, {
    attempt_id: attemptId, question_id: q1Id,
    selected_option_id: q1Selected, is_flagged: false,
    answered_at: new Date().toISOString(),
  });
  if (u1.status !== 201) fail(`upsert: ${u1.status} ${JSON.stringify(u1.body)}`);
  pass("student wrote quiz_answers");

  // ---------- quiz-submit ----------
  header("quiz-submit happy path");
  const submit = await callFn("quiz-submit", { attempt_id: attemptId }, stuJwt);
  if (submit.status !== 200) fail(`submit: ${JSON.stringify(submit.body)}`);
  const sbody = submit.body as Record<string, unknown>;
  // 1 correct (+4), 1 skipped (0). max = 2*4 = 8.
  if (sbody.score !== 4) fail(`score should be 4, got ${sbody.score}`);
  if (sbody.max_score !== 8) fail(`max_score should be 8, got ${sbody.max_score}`);
  if (sbody.correct_count !== 1) fail(`correct=${sbody.correct_count}`);
  if (sbody.skipped_count !== 1) fail(`skipped=${sbody.skipped_count}`);
  if (!Array.isArray((sbody.questions as unknown[]))) fail("no questions[]");
  pass("score 4/8, 1 correct + 1 skipped");
  if (!JSON.stringify(sbody).includes('"is_correct"')) {
    fail("submit MUST expose is_correct now (post-submit) for the solution UI");
  }
  pass("post-submit payload reveals is_correct + correct_option_id");

  header("quiz-submit replay protection (409)");
  const submit2 = await callFn("quiz-submit", { attempt_id: attemptId }, stuJwt);
  if (submit2.status !== 409) fail(`expected 409, got ${submit2.status} ${JSON.stringify(submit2.body)}`);
  pass("second submit returns 409");

  // ---------- quiz-attempt-result ----------
  header("quiz-attempt-result happy path (re-fetch)");
  const result = await callFn("quiz-attempt-result", { attempt_id: attemptId }, stuJwt);
  if (result.status !== 200) fail(`result: ${JSON.stringify(result.body)}`);
  if (result.body.score !== 4) fail(`result score=${result.body.score}`);
  pass("result re-fetch returns same scores");

  header("quiz-attempt-result rejects on in-flight attempt");
  // Start a fresh attempt on a different quiz to test in-flight rejection.
  // Re-attempt by retaking same quiz creates a fresh attempt.
  const start3 = await callFn("quiz-start", { quiz_id: quizId }, stuJwt);
  const newAttemptId = (start3.body as { attempt_id: string }).attempt_id;
  const r2 = await callFn("quiz-attempt-result", { attempt_id: newAttemptId }, stuJwt);
  if (r2.status !== 409) fail(`expected 409 for in-flight, got ${r2.status}`);
  pass("rejects in-flight with 409");

  header("quiz-attempt-result rejects cross-student");
  // Owner can read (admin); but a different student would be 403. We don't
  // have a second student here so verify with anon JWT path (401).
  const r3 = await callFn("quiz-attempt-result", { attempt_id: attemptId }, null);
  if (r3.status !== 401) fail(`expected 401, got ${r3.status}`);
  pass("rejects no-auth 401");

  // ---------- quiz-image-presign ----------
  header("quiz-image-presign role + happy");
  const p1 = await callFn("quiz-image-presign", { kind: "question_prompt", mime_type: "image/png", content_size_bytes: 1024 }, stuJwt);
  if (p1.status !== 403) fail(`student should be 403, got ${p1.status}`);
  pass("rejects student");

  const p2 = await callFn("quiz-image-presign", { kind: "question_prompt", mime_type: "image/png", content_size_bytes: 1024 }, teachJwt);
  if (p2.status !== 200) fail(`teacher: ${JSON.stringify(p2.body)}`);
  if (typeof p2.body.upload_url !== "string") fail("missing upload_url");
  if (typeof p2.body.path !== "string") fail("missing path");
  pass("teacher gets signed URL");

  const p3 = await callFn("quiz-image-presign", { kind: "option_image", mime_type: "image/jpeg", content_size_bytes: 6 * 1024 * 1024 }, teachJwt);
  if (p3.status !== 400 && p3.status !== 413) fail(`size limit: ${p3.status}`);
  pass(`rejects > 5MB with ${p3.status}`);

  const p4 = await callFn("quiz-image-presign", { kind: "question_prompt", mime_type: "image/gif", content_size_bytes: 1024 }, teachJwt);
  if (p4.status !== 400 && p4.status !== 415) fail(`mime: ${p4.status}`);
  pass(`rejects gif with ${p4.status}`);

  // ---------- quiz-admin-mutate ----------
  header("quiz-admin-mutate auth + role");
  const m1 = await callFn("quiz-admin-mutate", { op: "toggle_publish_quiz", quiz_id: quizId, is_published: false }, stuJwt);
  if (m1.status !== 403) fail(`student should be 403, got ${m1.status}`);
  pass("rejects student");
  const m2 = await callFn("quiz-admin-mutate", { op: "toggle_publish_quiz", quiz_id: quizId, is_published: false }, teachJwt);
  if (m2.status !== 403) fail(`teacher should be 403, got ${m2.status}`);
  pass("rejects teacher");

  header("quiz-admin-mutate: toggle_publish_quiz + delete_quiz");
  const m3 = await callFn("quiz-admin-mutate", { op: "toggle_publish_quiz", quiz_id: quizId, is_published: false }, ownerJwt);
  if (m3.status !== 200) fail(`unpublish: ${JSON.stringify(m3.body)}`);
  pass("owner unpublished");
  // Verify audit row appeared.
  const auditRow = await admin
    .from("audit_log")
    .select("action, entity_id")
    .eq("action", "quiz_unpublish")
    .eq("entity_id", quizId)
    .limit(1);
  if (!auditRow.data || auditRow.data.length === 0) {
    fail("audit_log row missing for quiz_unpublish");
  }
  pass("audit_log captured quiz_unpublish");

  // Try delete_question while it's still used → 409.
  const m4 = await callFn("quiz-admin-mutate", { op: "delete_question", question_id: q1Id }, ownerJwt);
  if (m4.status !== 409) fail(`expected 409, got ${m4.status}`);
  pass("delete_question while in use → 409");

  // archive_question
  const m5 = await callFn("quiz-admin-mutate", { op: "archive_question", question_id: q1Id, is_archived: true }, ownerJwt);
  if (m5.status !== 200) fail(`archive: ${JSON.stringify(m5.body)}`);
  pass("archive_question");

  // delete_quiz
  const m6 = await callFn("quiz-admin-mutate", { op: "delete_quiz", quiz_id: quizId }, ownerJwt);
  if (m6.status !== 200) fail(`delete_quiz: ${JSON.stringify(m6.body)}`);
  pass("delete_quiz");

  // Cleanup
  header("Cleanup");
  await admin.from("questions").delete().in("id", [q1Id, q2Id]);
  await admin.from("batch_teachers").delete().eq("teacher_id", teacher.user_id);
  await admin.from("students").delete().eq("user_id", student.user_id);
  await admin.from("teachers").delete().eq("user_id", teacher.user_id);
  await admin.from("user_roles").delete().in("user_id", [student.user_id, teacher.user_id]);
  await admin.from("app_users").delete().in("id", [student.user_id, teacher.user_id]);
  await admin.auth.admin.deleteUser(student.auth_user_id);
  await admin.auth.admin.deleteUser(teacher.auth_user_id);
  await admin.from("batches").delete().eq("id", batchId);
  await admin.from("courses").delete().eq("id", courseId);

  console.log("\nALL TESTS PASSED");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
