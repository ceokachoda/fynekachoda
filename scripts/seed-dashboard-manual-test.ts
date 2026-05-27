// Phase 8 — Manual-test fixture for the mastery / streaks / dashboard work.
//
// Plants one course + one batch + one teacher + three students with deliberately
// varied signals so every dashboard slice is exercisable on a real device:
//
//   A1 "Streak Star"  — 7-day streak, weak Kinematics (~25%), strong Laws (100%),
//                       a video in progress, an offline score, high attendance,
//                       a submitted exam awaiting release.
//   A2 "At Risk"      — very low Kinematics mastery (~4%), low attendance (~33%)
//                       => shows up in the teacher's at-risk list.
//   A3 "Fresh Start"  — no activity at all => dashboard renders clean zeros.
//
// Today's schedule: one past class (A1 present, A2 absent) + one class starting in
// ~20 min (drives next-card priority 3).
//
// Run:
//   pnpm seed:dashboard-manual-test          # fresh fixtures
//   pnpm seed:dashboard-manual-test --reset  # wipe prior p8-* fixtures first
//
// Prints credentials at the end. mastery_recompute + streak_recompute run last so
// the mastery + streaks tables reflect the seed immediately.

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

async function callFn(name: string, body: unknown, jwt: string, allow: number[] = []) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status !== 200 && !allow.includes(res.status)) {
    die(`callFn ${name}: ${res.status} ${JSON.stringify(data)}`);
  }
  return { status: res.status, data: data as Record<string, unknown> };
}

const istDate = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

async function resetPriorFixtures(admin: SupabaseClient) {
  h("Reset — wiping prior `p8-*` fixtures");
  const stale = await admin.from("app_users").select("id, auth_user_id").like("email", "p8-%").limit(500);
  const ids = (stale.data ?? []).map((r) => r.id as string);
  const authIds = (stale.data ?? []).map((r) => r.auth_user_id as string);
  if (ids.length > 0) {
    const ea = await admin.from("exam_attempts").select("id").in("student_id", ids);
    const eaIds = (ea.data ?? []).map((r: { id: string }) => r.id);
    if (eaIds.length > 0) await admin.from("exam_answers").delete().in("attempt_id", eaIds);
    await admin.from("exam_attempts").delete().in("student_id", ids);
    const qa = await admin.from("quiz_attempts").select("id").in("student_id", ids);
    const qaIds = (qa.data ?? []).map((r: { id: string }) => r.id);
    if (qaIds.length > 0) await admin.from("quiz_answers").delete().in("attempt_id", qaIds);
    await admin.from("quiz_attempts").delete().in("student_id", ids);
    await admin.from("offline_test_scores").delete().in("student_id", ids);
    await admin.from("video_progress").delete().in("student_id", ids);
    await admin.from("pdf_progress").delete().in("student_id", ids);
    await admin.from("attendance").delete().in("student_id", ids);
    await admin.from("activity_days").delete().in("student_id", ids);
    await admin.from("mastery").delete().in("student_id", ids);
    await admin.from("streaks").delete().in("student_id", ids);
    await admin.from("batch_teachers").delete().in("teacher_id", ids);
    await admin.from("students").delete().in("user_id", ids);
    await admin.from("teachers").delete().in("user_id", ids);
    await admin.from("user_roles").delete().in("user_id", ids);
    await admin.from("audit_log").delete().in("actor_user_id", ids);
  }
  const oldCourses = await admin.from("courses").select("id").like("code", "P8_TEST_%");
  const oldCourseIds = (oldCourses.data ?? []).map((r: { id: string }) => r.id);
  if (oldCourseIds.length > 0) {
    const oldBatches = await admin.from("batches").select("id").in("course_id", oldCourseIds);
    const bIds = (oldBatches.data ?? []).map((r: { id: string }) => r.id);
    await admin.from("attendance").delete().in(
      "session_id",
      (await admin.from("sessions").select("id").in("batch_id", bIds)).data?.map((r: { id: string }) => r.id) ?? [],
    );
    await admin.from("sessions").delete().in("batch_id", bIds);
    await admin.from("exams").delete().in("batch_id", bIds);
    await admin.from("quizzes").delete().in("course_id", oldCourseIds);
    await admin.from("content_items").delete().in("course_id", oldCourseIds);
    const tq = await admin
      .from("topics")
      .select("id, chapters!inner(subjects!inner(course_id))")
      .in("chapters.subjects.course_id", oldCourseIds);
    const tIds = (tq.data ?? []).map((r: { id: string }) => r.id);
    if (tIds.length > 0) await admin.from("questions").delete().in("topic_id", tIds);
    await admin.from("batches").delete().in("id", bIds);
    await admin.from("courses").delete().in("id", oldCourseIds);
    info(`deleted ${oldCourseIds.length} prior P8_TEST_* courses (+ cascaded children)`);
  }
  if (ids.length > 0) {
    let deleted = 0;
    for (let i = 0; i < ids.length; i++) {
      const { error } = await admin.from("app_users").delete().eq("id", ids[i]!);
      if (error) continue;
      try { await admin.auth.admin.deleteUser(authIds[i]!); } catch { /* ignore */ }
      deleted++;
    }
    info(`deleted ${deleted}/${ids.length} prior p8-* users`);
  }
}

async function main() {
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  const ownerJwt = await signIn(OWNER_EMAIL, OWNER_PASSWORD);
  if (RESET) await resetPriorFixtures(admin);

  const ts = Date.now();
  const courseCode = `P8_TEST_${ts}`;

  h("Curriculum");
  const course = (await callFn("curriculum-mutate", { op: "create_course", payload: { code: courseCode, name: `Phase 8 Test ${ts}` } }, ownerJwt)).data.row as { id: string };
  const subject = (await callFn("curriculum-mutate", { op: "create_subject", payload: { course_id: course.id, name: "Physics", sort_order: 0 } }, ownerJwt)).data.row as { id: string };
  const chapter = (await callFn("curriculum-mutate", { op: "create_chapter", payload: { subject_id: subject.id, name: "Mechanics", sort_order: 0 } }, ownerJwt)).data.row as { id: string };
  const topicKin = ((await callFn("curriculum-mutate", { op: "create_topic", payload: { chapter_id: chapter.id, name: "Kinematics", sort_order: 0 } }, ownerJwt)).data.row as { id: string }).id;
  const topicLaws = ((await callFn("curriculum-mutate", { op: "create_topic", payload: { chapter_id: chapter.id, name: "Laws of Motion", sort_order: 1 } }, ownerJwt)).data.row as { id: string }).id;
  info(`course=${course.id.slice(0, 8)}… topics: Kinematics, Laws of Motion`);

  h("Batch + teacher + students");
  const today = istDate(new Date());
  const batch = (await callFn("batch-mutate", { op: "create_batch", payload: { course_id: course.id, name: `P8_A_${ts}`, starts_on: today, capacity: 30 } }, ownerJwt)).data.row as { id: string };
  const teacher = (await callFn("auth-bootstrap", { role: "teacher", full_name: `P8 Teacher ${ts}`, email: `p8-teach-${ts}@fynestudy.example.com`, subjects: ["physics"] }, ownerJwt)).data as Acct;
  await callFn("batch-mutate", { op: "assign_teacher", batch_id: batch.id, teacher_id: teacher.user_id }, ownerJwt);

  const a1 = (await callFn("auth-bootstrap", { role: "student", full_name: `P8 Streak Star ${ts}`, email: `p8-stu-a1-${ts}@fynestudy.example.com`, parent_consent_method: "verbal", batch_id: batch.id }, ownerJwt)).data as Acct;
  const a2 = (await callFn("auth-bootstrap", { role: "student", full_name: `P8 At Risk ${ts}`, email: `p8-stu-a2-${ts}@fynestudy.example.com`, parent_consent_method: "verbal", batch_id: batch.id }, ownerJwt)).data as Acct;
  const a3 = (await callFn("auth-bootstrap", { role: "student", full_name: `P8 Fresh Start ${ts}`, email: `p8-stu-a3-${ts}@fynestudy.example.com`, parent_consent_method: "verbal", batch_id: batch.id }, ownerJwt)).data as Acct;
  await admin.from("app_users").update({ must_change_password: false }).in("id", [teacher.user_id, a1.user_id, a2.user_id, a3.user_id]);

  h("Questions + quizzes");
  const makeQ = async (topicId: string, prompt: string) => {
    const q = await admin.from("questions").insert({ topic_id: topicId, prompt_md: prompt, difficulty: "easy", created_by: teacher.user_id }).select("id").single();
    if (q.error || !q.data) die(`question insert: ${q.error?.message}`);
    await admin.from("question_options").insert([
      { question_id: q.data.id, text_md: "Correct option", is_correct: true, sort_order: 0 },
      { question_id: q.data.id, text_md: "Wrong A", is_correct: false, sort_order: 1 },
      { question_id: q.data.id, text_md: "Wrong B", is_correct: false, sort_order: 2 },
      { question_id: q.data.id, text_md: "Wrong C", is_correct: false, sort_order: 3 },
    ]);
    await admin.from("question_solutions").insert({ question_id: q.data.id, explanation_md: "Because physics." });
    return q.data.id as string;
  };
  const kinQs = [await makeQ(topicKin, "Kinematics Q1"), await makeQ(topicKin, "Kinematics Q2"), await makeQ(topicKin, "Kinematics Q3")];
  const lawsQs = [await makeQ(topicLaws, "Laws Q1"), await makeQ(topicLaws, "Laws Q2")];

  const makeQuiz = async (title: string, topicId: string, qids: string[]) => {
    const quiz = await admin.from("quizzes").insert({ title, topic_id: topicId, course_id: course.id, batch_id: batch.id, duration_min: 20, is_published: true, created_by: teacher.user_id }).select("id").single();
    if (quiz.error || !quiz.data) die(`quiz insert: ${quiz.error?.message}`);
    await admin.from("quiz_questions").insert(qids.map((qid, i) => ({ quiz_id: quiz.data!.id, question_id: qid, sort_order: i })));
    return quiz.data.id as string;
  };
  const kinQuiz = await makeQuiz("Kinematics Practice", topicKin, kinQs);
  const lawsQuiz = await makeQuiz("Laws Practice", topicLaws, lawsQs);

  h("Quiz attempts (drive mastery)");
  // quiz_attempts_check requires a submitted attempt to carry score + max_score
  // + the correct/wrong/skipped counts. Counts are illustrative fixtures.
  const attempt = async (
    quizId: string, student: string, score: number, max: number,
    correct: number, wrong: number, skipped: number, daysAgo: number,
  ) => {
    const r = await admin.from("quiz_attempts").insert({
      quiz_id: quizId, student_id: student,
      started_at: new Date(Date.now() - daysAgo * 86400000 - 600000).toISOString(),
      submitted_at: new Date(Date.now() - daysAgo * 86400000).toISOString(),
      score, max_score: max, correct_count: correct, wrong_count: wrong, skipped_count: skipped,
      is_practice: true,
    });
    if (r.error) die(`quiz_attempt insert: ${r.error.message}`);
  };
  // A1: Kinematics weak (~28% pooled with the exam), Laws strong (100%)
  await attempt(kinQuiz, a1.user_id, 2, 12, 1, 2, 0, 4);
  await attempt(kinQuiz, a1.user_id, 4, 12, 1, 0, 2, 2);
  await attempt(lawsQuiz, a1.user_id, 8, 8, 2, 0, 0, 3);
  await attempt(lawsQuiz, a1.user_id, 8, 8, 2, 0, 0, 1);
  // A2: Kinematics very low (~8%)
  await attempt(kinQuiz, a2.user_id, 0, 12, 0, 0, 3, 3);
  await attempt(kinQuiz, a2.user_id, 2, 12, 1, 2, 0, 1);

  h("Exam (awaiting release) + A1 submitted attempt");
  const examIns = await admin.from("exams").insert({
    title: `Mechanics Unit Test ${ts}`, batch_id: batch.id,
    starts_at: new Date(Date.now() - 2 * 3600000).toISOString(), duration_min: 60,
    marks_correct: 4, marks_wrong: -1, marks_skip: 0, result_release: "manual", is_published: true,
    created_by: teacher.user_id,
  }).select("id").single();
  const examId = examIns.data!.id as string;
  await admin.from("exam_questions").insert(kinQs.map((qid, i) => ({ exam_id: examId, question_id: qid, sort_order: i })));
  await admin.from("exam_attempts").insert({
    exam_id: examId, student_id: a1.user_id,
    started_at: new Date(Date.now() - 110 * 60000).toISOString(),
    deadline_at: new Date(Date.now() - 50 * 60000).toISOString(),
    submitted_at: new Date(Date.now() - 60 * 60000).toISOString(),
    score: 4, max_score: 12, correct_count: 1, wrong_count: 2, skipped_count: 0,
    question_snapshot: { questions: [] },
  });

  h("Sessions + attendance (last 14 days + today)");
  const sessionRows: { batch_id: string; subject_id: string; scheduled_start: string; scheduled_end: string; status: string }[] = [];
  for (let i = 0; i < 8; i++) {
    const start = new Date(Date.now() - (i + 1) * 1.7 * 86400000);
    sessionRows.push({
      batch_id: batch.id, subject_id: subject.id,
      scheduled_start: start.toISOString(),
      scheduled_end: new Date(start.getTime() + 90 * 60000).toISOString(),
      status: "ended",
    });
  }
  const todayPastStart = new Date(Date.now() - 2 * 3600000);
  const todayUpStart = new Date(Date.now() + 20 * 60000);
  sessionRows.push({ batch_id: batch.id, subject_id: subject.id, scheduled_start: todayPastStart.toISOString(), scheduled_end: new Date(todayPastStart.getTime() + 90 * 60000).toISOString(), status: "ended" });
  sessionRows.push({ batch_id: batch.id, subject_id: subject.id, scheduled_start: todayUpStart.toISOString(), scheduled_end: new Date(todayUpStart.getTime() + 60 * 60000).toISOString(), status: "scheduled" });
  const sessIns = await admin.from("sessions").insert(sessionRows).select("id, scheduled_start").order("scheduled_start", { ascending: true });
  if (sessIns.error) die(`sessions insert: ${sessIns.error.message}`);
  const sessions = sessIns.data as { id: string; scheduled_start: string }[];
  // 9 of these are "ended" (8 past + today's past); the last (upcoming) gets no attendance.
  const endedSessions = sessions.filter((s) => new Date(s.scheduled_start).getTime() < Date.now());
  const att: { session_id: string; student_id: string; status: string; method: string }[] = [];
  endedSessions.forEach((s, i) => {
    att.push({ session_id: s.id, student_id: a1.user_id, status: i === 0 ? "absent" : "present", method: "manual" }); // A1 ~89%
    if (i < 3) att.push({ session_id: s.id, student_id: a2.user_id, status: "present", method: "manual" }); // A2 ~33%
    else att.push({ session_id: s.id, student_id: a2.user_id, status: "absent", method: "manual" });
  });
  await admin.from("attendance").insert(att);

  h("Streak activity_days, continue-watching video, offline score");
  // A1: 7-day consecutive streak ending today (IST).
  const a1Days: { student_id: string; day: string }[] = [];
  for (let i = 0; i < 7; i++) a1Days.push({ student_id: a1.user_id, day: istDate(new Date(Date.now() - i * 86400000)) });
  // A2: two sparse days (broken streak).
  a1Days.push({ student_id: a2.user_id, day: istDate(new Date(Date.now() - 1 * 86400000)) });
  a1Days.push({ student_id: a2.user_id, day: istDate(new Date(Date.now() - 5 * 86400000)) });
  await admin.from("activity_days").upsert(a1Days, { onConflict: "student_id,day", ignoreDuplicates: true });

  const vid = await admin.from("content_items").insert({
    kind: "video", title: "Kinematics — Crash Course", topic_id: topicKin, course_id: course.id, batch_id: batch.id,
    yt_video_id: `p8v${String(ts).slice(-8)}`, uploaded_by: teacher.user_id, is_published: true, duration_sec: 600,
  }).select("id").single();
  if (vid.error || !vid.data) die(`content_items insert: ${vid.error?.message}`);
  const vp = await admin.from("video_progress").insert({
    student_id: a1.user_id, content_id: vid.data.id, position_sec: 270, watched_pct: 45,
    last_watched_at: new Date().toISOString(),
  });
  if (vp.error) die(`video_progress insert: ${vp.error.message}`);

  await admin.from("offline_test_scores").insert({
    batch_id: batch.id, student_id: a1.user_id, subject_id: subject.id,
    test_name: `Weekly Paper Test ${ts}`, test_date: today, score: 68, max_score: 100, entered_by: teacher.user_id,
  });

  h("Recompute mastery + streaks");
  const mr = await admin.rpc("mastery_recompute", { p_full: true });
  if (mr.error) die(`mastery_recompute: ${mr.error.message}`);
  const sr = await admin.rpc("streak_recompute");
  if (sr.error) die(`streak_recompute: ${sr.error.message}`);
  info(`mastery rows upserted (full sweep): ${mr.data}; total streak rows: ${sr.data}`);

  h("Summary");
  console.log(`
Course:   ${courseCode}   Batch: P8_A_${ts} (${batch.id})
Topics:   Kinematics, Laws of Motion

Teacher (sees batch analytics + pending exam release)
  Email     ${teacher.email}
  Password  ${teacher.initial_password}

Student A1 "Streak Star"  ${a1.email} / ${a1.initial_password}
  -> 7-day streak, weak Kinematics (~25%) + strong Laws (100%), 1 video @45%,
     offline score 68/100, ~89% attendance, 1 exam submitted (awaiting release).

Student A2 "At Risk"      ${a2.email} / ${a2.initial_password}
  -> very low Kinematics (~4%), ~33% attendance => teacher at-risk list.

Student A3 "Fresh Start"  ${a3.email} / ${a3.initial_password}
  -> no activity => dashboard shows clean zeros + browse-library next card.

Today's schedule: 1 past class + 1 starting in ~20 min (next-card priority 3).

Re-run with \`pnpm seed:dashboard-manual-test --reset\` to wipe prior p8-* fixtures.
`);
}

interface Acct {
  user_id: string;
  auth_user_id: string;
  email: string;
  initial_password: string;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
