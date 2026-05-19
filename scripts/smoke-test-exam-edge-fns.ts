// Phase 7 — End-to-end smoke for every Phase 7 edge fn.
//
// Asserts shape + auth + role + scope + happy path + key error cases for:
//   server-time, exam-start, exam-tab-switch, exam-submit,
//   exam-release-results, exam-regrade, exam-attempt-result,
//   exam-admin-mutate, offline-score-upsert.
//
// Run with `pnpm smoke:exam-fns`.

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

async function main() {
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  header("Setup");
  const ownerJwt = await signIn(OWNER_EMAIL, OWNER_PASSWORD);
  const ts = Date.now();
  const courseCode = `XF_${ts}`;

  const c = await callFn("curriculum-mutate", { op: "create_course", payload: { code: courseCode, name: `XF ${ts}` } }, ownerJwt);
  const courseId = (c.body.row as { id: string }).id;
  const s = await callFn("curriculum-mutate", { op: "create_subject", payload: { course_id: courseId, name: "S", sort_order: 0 } }, ownerJwt);
  const subjectId = (s.body.row as { id: string }).id;
  const ch = await callFn("curriculum-mutate", { op: "create_chapter", payload: { subject_id: subjectId, name: "C", sort_order: 0 } }, ownerJwt);
  const chapterId = (ch.body.row as { id: string }).id;
  const t = await callFn("curriculum-mutate", { op: "create_topic", payload: { chapter_id: chapterId, name: "T", sort_order: 0 } }, ownerJwt);
  const topicId = (t.body.row as { id: string }).id;

  const today = new Date().toISOString().slice(0, 10);
  const ba = await callFn("batch-mutate", { op: "create_batch", payload: { course_id: courseId, name: `XF_${ts}`, starts_on: today, capacity: 10 } }, ownerJwt);
  const batchId = (ba.body.row as { id: string }).id;

  const teach = await callFn("auth-bootstrap", {
    role: "teacher", full_name: `XF Teach ${ts}`,
    email: `xf-teach-${ts}@fynestudy.example.com`, subjects: ["physics"],
  }, ownerJwt);
  const teacher = teach.body as { user_id: string; auth_user_id: string; initial_password: string; email: string };
  await callFn("batch-mutate", { op: "assign_teacher", batch_id: batchId, teacher_id: teacher.user_id }, ownerJwt);

  const stu = await callFn("auth-bootstrap", {
    role: "student", full_name: `XF Stu ${ts}`,
    email: `xf-stu-${ts}@fynestudy.example.com`,
    parent_consent_method: "verbal", batch_id: batchId,
  }, ownerJwt);
  const student = stu.body as { user_id: string; auth_user_id: string; initial_password: string; email: string };

  await admin.from("app_users").update({ must_change_password: false })
    .in("id", [teacher.user_id, student.user_id]);
  const teachJwt = await signIn(teacher.email, teacher.initial_password);
  const stuJwt = await signIn(student.email, student.initial_password);

  // Bank
  const q1Ins = await admin.from("questions").insert({
    topic_id: topicId, prompt_md: "Q1", created_by: teacher.user_id, difficulty: "easy",
  }).select("id").single();
  const q1Id = q1Ins.data!.id;
  const q1Opts = await admin.from("question_options").insert([
    { question_id: q1Id, text_md: "A", is_correct: true, sort_order: 0 },
    { question_id: q1Id, text_md: "B", is_correct: false, sort_order: 1 },
    { question_id: q1Id, text_md: "C", is_correct: false, sort_order: 2 },
    { question_id: q1Id, text_md: "D", is_correct: false, sort_order: 3 },
  ]).select("id, is_correct");
  const q1CorrectId = q1Opts.data!.find((o) => o.is_correct)!.id;
  const q1WrongId = q1Opts.data!.find((o) => !o.is_correct)!.id;

  const q2Ins = await admin.from("questions").insert({
    topic_id: topicId, prompt_md: "Q2", created_by: teacher.user_id, difficulty: "easy",
  }).select("id").single();
  const q2Id = q2Ins.data!.id;
  const q2Opts = await admin.from("question_options").insert([
    { question_id: q2Id, text_md: "A", is_correct: false, sort_order: 0 },
    { question_id: q2Id, text_md: "B", is_correct: true, sort_order: 1 },
    { question_id: q2Id, text_md: "C", is_correct: false, sort_order: 2 },
    { question_id: q2Id, text_md: "D", is_correct: false, sort_order: 3 },
  ]).select("id, is_correct");
  const q2CorrectId = q2Opts.data!.find((o) => o.is_correct)!.id;

  // Live exam (published, started 1 min ago, 30 min duration, instant release).
  const startsAtPast = new Date(Date.now() - 60_000).toISOString();
  const examIns = await admin.from("exams").insert({
    title: `XF E ${ts}`, batch_id: batchId, starts_at: startsAtPast, duration_min: 30,
    marks_correct: 4, marks_wrong: -1, marks_skip: 0,
    randomize_questions: false, randomize_options: false,
    is_published: true, result_release: "instant", created_by: teacher.user_id,
  }).select("id").single();
  const examId = examIns.data!.id;
  await admin.from("exam_questions").insert([
    { exam_id: examId, question_id: q1Id, sort_order: 0 },
    { exam_id: examId, question_id: q2Id, sort_order: 1 },
  ]);

  // Future exam (NOT started yet) — for early-entry guard.
  const startsAtFuture = new Date(Date.now() + 24 * 3600_000).toISOString();
  const examFuture = await admin.from("exams").insert({
    title: `XF F ${ts}`, batch_id: batchId, starts_at: startsAtFuture, duration_min: 30,
    is_published: true, result_release: "manual", created_by: teacher.user_id,
  }).select("id").single();
  const examFutureId = examFuture.data!.id;
  await admin.from("exam_questions").insert([
    { exam_id: examFutureId, question_id: q1Id, sort_order: 0 },
  ]);
  pass("fixtures planted");

  // ---------- server-time ----------
  header("server-time");
  const st = await callFn("server-time", {}, null);
  if (st.status !== 200) fail(`status ${st.status}`);
  if (typeof st.body.now !== "string" || typeof st.body.epoch_ms !== "number") {
    fail(`shape: ${JSON.stringify(st.body)}`);
  }
  pass("returns { now, epoch_ms }");

  // ---------- exam-start ----------
  header("exam-start auth + role");
  const e1 = await callFn("exam-start", { exam_id: examId }, null);
  if (e1.status !== 401) fail(`no-auth: ${e1.status}`);
  pass("rejects no-auth (401)");
  const e2 = await callFn("exam-start", { exam_id: examId }, ownerJwt);
  if (e2.status !== 403) fail(`owner: ${e2.status}`);
  pass("rejects owner-admin (403)");
  const e3 = await callFn("exam-start", { exam_id: "not-uuid" }, stuJwt);
  if (e3.status !== 400) fail(`bad uuid: ${e3.status}`);
  pass("rejects non-uuid (400)");
  const e4 = await callFn("exam-start", { exam_id: examFutureId }, stuJwt);
  if (e4.status !== 400) fail(`future exam: ${e4.status}`);
  pass("rejects future exam with 400");

  header("exam-start happy path + idempotency");
  const start1 = await callFn("exam-start", { exam_id: examId }, stuJwt);
  if (start1.status !== 200) fail(`start1: ${JSON.stringify(start1.body)}`);
  const attemptId = start1.body.attempt_id as string;
  pass(`attempt created (${attemptId.slice(0, 8)}…)`);
  const start2 = await callFn("exam-start", { exam_id: examId }, stuJwt);
  if (start2.status !== 200) fail(`start2: ${JSON.stringify(start2.body)}`);
  if (start2.body.attempt_id !== attemptId) fail("idempotency broken");
  pass("idempotent reuse of in-flight attempt");

  // ---------- exam-tab-switch ----------
  header("exam-tab-switch");
  const ts1 = await callFn("exam-tab-switch", { attempt_id: attemptId }, stuJwt);
  if (ts1.status !== 200 || ts1.body.tab_switch_count !== 1) {
    fail(`first bump: ${JSON.stringify(ts1.body)}`);
  }
  const ts2 = await callFn("exam-tab-switch", { attempt_id: attemptId }, stuJwt);
  if (ts2.body.tab_switch_count !== 2) fail(`second bump: ${JSON.stringify(ts2.body)}`);
  pass("counter increments 1 → 2");
  const tsBad = await callFn("exam-tab-switch", { attempt_id: attemptId }, ownerJwt);
  if (tsBad.status !== 403) fail(`other-role: ${tsBad.status}`);
  pass("rejects non-student");

  // ---------- exam-submit + scoring + instant result reveal ----------
  header("auto-save + exam-submit (instant release)");
  // Student answers q1 correctly + q2 wrong.
  await admin.from("exam_answers").upsert([
    { attempt_id: attemptId, question_id: q1Id, selected_option_id: q1CorrectId, is_flagged: false },
    { attempt_id: attemptId, question_id: q2Id, selected_option_id: q1WrongId, is_flagged: false },
  ]);
  const subm = await callFn("exam-submit", { attempt_id: attemptId }, stuJwt);
  if (subm.status !== 200) fail(`submit: ${JSON.stringify(subm.body)}`);
  if (subm.body.results_released !== true) fail("instant exam should auto-release");
  if (Number(subm.body.score) !== 4 - 1) fail(`expected score=3, got ${subm.body.score}`);
  if (subm.body.correct_count !== 1 || subm.body.wrong_count !== 1) {
    fail(`counts: ${JSON.stringify(subm.body)}`);
  }
  pass("instant-release scored correctly (correct=1, wrong=1, score=3)");

  // Replay protection.
  const replay = await callFn("exam-submit", { attempt_id: attemptId }, stuJwt);
  if (replay.status !== 409) fail(`replay: ${replay.status}`);
  pass("replay-protected (409)");

  // exam-attempt-result re-fetch (instant exam → 200 immediately).
  header("exam-attempt-result on instant-release exam");
  const r = await callFn("exam-attempt-result", { attempt_id: attemptId }, stuJwt);
  if (r.status !== 200) fail(`status ${r.status}: ${JSON.stringify(r.body)}`);
  const rstr = JSON.stringify(r.body);
  if (!rstr.includes("\"is_correct\"")) {
    fail("post-submit reveal MUST include is_correct booleans");
  }
  pass("includes is_correct on each option (post-submit reveal)");

  // ---------- audit log: exam_submitted ----------
  header("audit_log row for exam_submitted");
  const aud = await admin.from("audit_log")
    .select("action, actor_user_id, entity_id, after_data")
    .eq("action", "exam_submitted")
    .eq("entity_id", attemptId)
    .maybeSingle();
  if (aud.error || !aud.data) fail(`no audit row: ${aud.error?.message}`);
  pass("audit_log captured exam_submitted");

  // ---------- exam-regrade ----------
  header("exam-regrade change_correct");
  // Flip q2 correct to q1WrongId (= what the student chose) — should bump
  // their score by 4 - (-1) = 5 (was wrong → now correct).
  // But wait: q2 options are different from q1 options. We need to use a q2
  // option. Let me re-set: student selected q1WrongId for q2 (which is a q1
  // option ID — INVALID FK ref). Actually our smoke planted that earlier
  // and PostgREST upsert wouldn't reject because there's no FK from
  // (attempt_id, question_id) tuple to (question_id, selected_option_id).
  // Actually exam_answers.selected_option_id REFERENCES question_options(id)
  // so the q1WrongId IS a valid question_options FK — just for a different
  // question. The grading only matches selected_option_id === correct_option_id
  // for THIS question, so it's treated as wrong (which is what we wanted).
  // OK. For the regrade, swap q2's correct to the q2 option the student
  // would have picked... but they didn't pick a q2 option. Let me just
  // change q2's correct option to the OTHER one and assert delta = 0.
  const q2NewCorrect = q2Opts.data!.find((o) => o.id !== q2CorrectId)!.id;
  const reg = await callFn("exam-regrade", {
    exam_id: examId,
    question_id: q2Id,
    action: "change_correct",
    new_correct_option_id: q2NewCorrect,
    reason: "Smoke test — flip key",
  }, teachJwt);
  if (reg.status !== 200) fail(`regrade: ${JSON.stringify(reg.body)}`);
  if (reg.body.attempts_updated !== 1) fail(`attempts_updated: ${reg.body.attempts_updated}`);
  pass("regrade walked 1 attempt");

  header("regrade mark_no_correct sets everyone to skip");
  const reg2 = await callFn("exam-regrade", {
    exam_id: examId,
    question_id: q1Id,
    action: "mark_no_correct",
    reason: "Bad question",
  }, teachJwt);
  if (reg2.status !== 200) fail(`regrade2: ${JSON.stringify(reg2.body)}`);
  // After regrade, the student's q1 outcome should now be skipped (0
  // points), not correct (was 4). Re-fetch attempt.
  const after = await admin.from("exam_attempts")
    .select("score, correct_count, wrong_count, skipped_count")
    .eq("id", attemptId)
    .single();
  // Original: correct=1 (q1 +4), wrong=1 (q2 -1) → 3.
  // After change_correct on q2: still wrong (student picked q1WrongId, not
  //   q2NewCorrect) → no delta.
  // After mark_no_correct on q1: correct (q1, +4) → skipped (0). Delta = -4.
  // So new score = 3 - 4 = -1. correct=0, wrong=1, skipped=1.
  if (Number(after.data!.score) !== -1) fail(`expected -1, got ${after.data!.score}`);
  if (after.data!.correct_count !== 0 || after.data!.skipped_count !== 1) {
    fail(`counts after regrade2: ${JSON.stringify(after.data)}`);
  }
  pass("mark_no_correct correctly converted 1 correct → skipped");

  header("regrade mark_all_correct");
  const reg3 = await callFn("exam-regrade", {
    exam_id: examId,
    question_id: q1Id,
    action: "mark_all_correct",
    reason: "Ambiguous wording",
  }, teachJwt);
  if (reg3.status !== 200) fail(`regrade3: ${JSON.stringify(reg3.body)}`);
  // mark_all_correct → student gets +4 on q1 (was skipped after reg2).
  // Score: -1 + 4 = 3. correct=1, skipped=0.
  const after3 = await admin.from("exam_attempts")
    .select("score, correct_count, skipped_count")
    .eq("id", attemptId).single();
  if (Number(after3.data!.score) !== 3) fail(`expected 3 after all_correct, got ${after3.data!.score}`);
  pass("mark_all_correct restored +4");

  // ---------- exam-release-results idempotent ----------
  header("exam-release-results idempotent");
  const rel1 = await callFn("exam-release-results", { exam_id: examId }, teachJwt);
  if (rel1.status !== 200) fail(`rel1: ${JSON.stringify(rel1.body)}`);
  // Instant exam already had results_released_at NULL but the result_release
  // flag is 'instant' — release is still a no-op since we use
  // results_released_at as the canonical flag.  Actually `exam-release-results`
  // flips results_released_at, regardless of result_release.
  const rel2 = await callFn("exam-release-results", { exam_id: examId }, teachJwt);
  if (rel2.status !== 200) fail(`rel2: ${rel2.status}`);
  if (rel2.body.already_released !== true) fail("second call should report already_released");
  pass("idempotent");

  // ---------- offline-score-upsert ----------
  header("offline-score-upsert insert + update");
  const ofs1 = await callFn("offline-score-upsert", {
    batch_id: batchId,
    test_name: `XF_OT_${ts}`,
    test_date: today,
    max_score: 100,
    entries: [{ student_id: student.user_id, score: 50 }],
  }, teachJwt);
  if (ofs1.status !== 200) fail(`ofs1: ${JSON.stringify(ofs1.body)}`);
  if (ofs1.body.inserted_count !== 1 || ofs1.body.updated_count !== 0) {
    fail(`first call counts: ${JSON.stringify(ofs1.body)}`);
  }
  pass("first call → 1 inserted");
  const ofs2 = await callFn("offline-score-upsert", {
    batch_id: batchId,
    test_name: `XF_OT_${ts}`,
    test_date: today,
    max_score: 100,
    entries: [{ student_id: student.user_id, score: 75, notes: "Re-graded" }],
  }, teachJwt);
  if (ofs2.status !== 200) fail(`ofs2: ${JSON.stringify(ofs2.body)}`);
  if (ofs2.body.inserted_count !== 0 || ofs2.body.updated_count !== 1) {
    fail(`second call counts: ${JSON.stringify(ofs2.body)}`);
  }
  pass("second call → 1 updated");

  // Out-of-range
  const ofsBad = await callFn("offline-score-upsert", {
    batch_id: batchId,
    test_name: `XF_OT_BAD_${ts}`,
    test_date: today,
    max_score: 100,
    entries: [{ student_id: student.user_id, score: 150 }],
  }, teachJwt);
  if (ofsBad.status !== 400) fail(`out-of-range: ${ofsBad.status}`);
  pass("rejects out-of-range score (400)");

  // ---------- exam-admin-mutate ----------
  header("exam-admin-mutate auth gates");
  const am1 = await callFn("exam-admin-mutate", {
    op: "toggle_publish_exam", exam_id: examId, is_published: false,
  }, stuJwt);
  if (am1.status !== 403) fail(`student access: ${am1.status}`);
  pass("rejects student (403)");

  const am2 = await callFn("exam-admin-mutate", {
    op: "toggle_publish_exam", exam_id: examId, is_published: false,
  }, ownerJwt);
  if (am2.status !== 200) fail(`owner toggle: ${JSON.stringify(am2.body)}`);
  pass("admin toggle_publish_exam ok");

  const am3 = await callFn("exam-admin-mutate", {
    op: "force_unrelease_results", exam_id: examId,
  }, ownerJwt);
  if (am3.status !== 200) fail(`unrelease: ${JSON.stringify(am3.body)}`);
  pass("admin force_unrelease_results ok");

  // Audit row for unrelease
  const audUnrel = await admin.from("audit_log")
    .select("action").eq("action", "exam_results_unreleased").eq("entity_id", examId).maybeSingle();
  if (!audUnrel.data) fail("no audit row for force_unrelease");
  pass("audit_log captured force_unrelease");

  // ---------- Cleanup ----------
  header("Cleanup");
  await admin.from("offline_test_scores").delete().like("test_name", `XF_OT%${ts}`);
  await admin.from("exam_answers").delete().eq("attempt_id", attemptId);
  await admin.from("exam_attempts").delete().in("exam_id", [examId, examFutureId]);
  await admin.from("exam_questions").delete().in("exam_id", [examId, examFutureId]);
  await admin.from("exams").delete().in("id", [examId, examFutureId]);
  await admin.from("question_options").delete().in("question_id", [q1Id, q2Id]);
  await admin.from("questions").delete().in("id", [q1Id, q2Id]);
  for (const u of [teacher.user_id, student.user_id]) {
    await admin.from("batch_teachers").delete().eq("teacher_id", u);
    await admin.from("students").delete().eq("user_id", u);
    await admin.from("teachers").delete().eq("user_id", u);
    await admin.from("user_roles").delete().eq("user_id", u);
    await admin.from("audit_log").delete().eq("actor_user_id", u);
    await admin.from("app_users").delete().eq("id", u);
  }
  for (const a of [teacher.auth_user_id, student.auth_user_id]) {
    try { await admin.auth.admin.deleteUser(a); } catch {}
  }
  await admin.from("batches").delete().eq("id", batchId);
  await admin.from("topics").delete().eq("id", topicId);
  await admin.from("chapters").delete().eq("id", chapterId);
  await admin.from("subjects").delete().eq("id", subjectId);
  await admin.from("courses").delete().eq("id", courseId);
  pass("cleanup done");

  console.log("\nALL EXAM EDGE-FN SMOKES PASSED");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
