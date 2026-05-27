// Phase 10 — Manual-test fixture for the leaderboard + gamification work.
//
// Plants ONE batch + one teacher + six students engineered to exercise every signal:
//
//   Topper      — #1 on the board (~0.86): top quiz scores, 7-day streak, full activity,
//                 100% perfect-week attendance + early scans, 80%+ mastery on a subject.
//                 Pending celebration: "Top of the Class".
//   Runner Up A — #2 (~0.62).            Runner Up B — #3 (~0.46).
//   Streak Star — a clean 7-day streak (orange flame) but mid-board (#4). Pending
//                 celebration: "Week Warrior".
//   At Risk     — composite ~0.12 (< 0.4) => shows in the teacher's at-risk list.
//   Centurion   — a backdated 100-quiz history => quiz_100. Pending celebration "Centurion".
//
// Run:
//   pnpm seed:leaderboard-manual-test          # fresh fixtures
//   pnpm seed:leaderboard-manual-test --reset  # wipe prior p10-* fixtures first
//
// Prints logins + a one-line "what correct looks like" per student. Runs
// streak_recompute + evaluate_student_badges + leaderboard_weekly_rollover last so the
// board, badges and snapshot reflect the seed immediately.

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
function h(s: string) {
  console.log(`\n== ${s} ==`);
}
function info(s: string) {
  console.log(`   ${s}`);
}
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

const iso = (d: Date) => d.toISOString();
const istDay = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

interface Acct {
  user_id: string;
  auth_user_id: string;
  email: string;
  initial_password: string;
}

async function resetPriorFixtures(admin: SupabaseClient) {
  h("Reset — wiping prior `p10-*` fixtures");
  const stale = await admin.from("app_users").select("id, auth_user_id").like("email", "p10-%").limit(500);
  const ids = (stale.data ?? []).map((r) => r.id as string);
  const authIds = (stale.data ?? []).map((r) => r.auth_user_id as string);
  if (ids.length > 0) {
    const qa = await admin.from("quiz_attempts").select("id").in("student_id", ids);
    const qaIds = (qa.data ?? []).map((r: { id: string }) => r.id);
    if (qaIds.length > 0) await admin.from("quiz_answers").delete().in("attempt_id", qaIds);
    await admin.from("quiz_attempts").delete().in("student_id", ids);
    await admin.from("badge_earnings").delete().in("student_id", ids);
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
  const oldCourses = await admin.from("courses").select("id").like("code", "P10_TEST_%");
  const oldCourseIds = (oldCourses.data ?? []).map((r: { id: string }) => r.id);
  if (oldCourseIds.length > 0) {
    const oldBatches = await admin.from("batches").select("id").in("course_id", oldCourseIds);
    const bIds = (oldBatches.data ?? []).map((r: { id: string }) => r.id);
    if (bIds.length > 0) {
      const sess = await admin.from("sessions").select("id").in("batch_id", bIds);
      const sIds = (sess.data ?? []).map((r: { id: string }) => r.id);
      if (sIds.length > 0) await admin.from("attendance").delete().in("session_id", sIds);
      await admin.from("leaderboard_snapshots").delete().in("batch_id", bIds);
      await admin.from("sessions").delete().in("batch_id", bIds);
      await admin.from("quizzes").delete().in("course_id", oldCourseIds);
      await admin.from("batches").delete().in("id", bIds);
    }
    await admin.from("courses").delete().in("id", oldCourseIds);
    info(`deleted ${oldCourseIds.length} prior P10_TEST_* courses (+ cascaded children)`);
  }
  if (ids.length > 0) {
    let deleted = 0;
    for (let i = 0; i < ids.length; i++) {
      const { error } = await admin.from("app_users").delete().eq("id", ids[i]!);
      if (error) continue;
      try {
        await admin.auth.admin.deleteUser(authIds[i]!);
      } catch {
        /* ignore */
      }
      deleted++;
    }
    info(`deleted ${deleted}/${ids.length} prior p10-* users`);
  }
}

async function main() {
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  const ownerJwt = await signIn(OWNER_EMAIL, OWNER_PASSWORD);
  if (RESET) await resetPriorFixtures(admin);

  const ts = Date.now();
  const courseCode = `P10_TEST_${ts}`;

  h("Curriculum");
  const course = (await callFn("curriculum-mutate", { op: "create_course", payload: { code: courseCode, name: `Phase 10 Test ${ts}` } }, ownerJwt)).data.row as { id: string };
  const subject = (await callFn("curriculum-mutate", { op: "create_subject", payload: { course_id: course.id, name: "Physics", sort_order: 0 } }, ownerJwt)).data.row as { id: string };
  const chapter = (await callFn("curriculum-mutate", { op: "create_chapter", payload: { subject_id: subject.id, name: "Mechanics", sort_order: 0 } }, ownerJwt)).data.row as { id: string };
  const topics: string[] = [];
  for (const [i, name] of ["Kinematics", "Laws of Motion", "Energy"].entries()) {
    topics.push(((await callFn("curriculum-mutate", { op: "create_topic", payload: { chapter_id: chapter.id, name, sort_order: i } }, ownerJwt)).data.row as { id: string }).id);
  }
  info(`course=${courseCode} · topics: Kinematics, Laws of Motion, Energy`);

  h("Batch + teacher + 6 students");
  const today = istDay(new Date());
  const batch = (await callFn("batch-mutate", { op: "create_batch", payload: { course_id: course.id, name: `P10_A_${ts}`, starts_on: today, capacity: 30 } }, ownerJwt)).data.row as { id: string };
  const teacher = (await callFn("auth-bootstrap", { role: "teacher", full_name: `P10 Teacher ${ts}`, email: `p10-teach-${ts}@fynestudy.example.com`, subjects: ["physics"] }, ownerJwt)).data as Acct;
  await callFn("batch-mutate", { op: "assign_teacher", batch_id: batch.id, teacher_id: teacher.user_id }, ownerJwt);

  const mk = async (tag: string, name: string) =>
    (await callFn("auth-bootstrap", { role: "student", full_name: name, email: `p10-${tag}-${ts}@fynestudy.example.com`, parent_consent_method: "verbal", batch_id: batch.id }, ownerJwt)).data as Acct;
  const topper = await mk("topper", `P10 Topper ${ts}`);
  const runnerA = await mk("runa", `P10 Runner Up A ${ts}`);
  const runnerB = await mk("runb", `P10 Runner Up B ${ts}`);
  const atRisk = await mk("risk", `P10 At Risk ${ts}`);
  const streakStar = await mk("streak", `P10 Streak Star ${ts}`);
  const centurion = await mk("cent", `P10 Centurion ${ts}`);
  const all = [topper, runnerA, runnerB, atRisk, streakStar, centurion];
  await admin.from("app_users").update({ must_change_password: false }).in("id", [teacher.user_id, ...all.map((s) => s.user_id)]);
  // Backdate enrolment ~14 days so the weekly Attendance factor (A) differentiates
  // (otherwise a same-day join caps expected-days at 1 and everyone scores A=1).
  await admin.from("students").update({ joined_at: iso(daysAgo(14)) }).in("user_id", all.map((s) => s.user_id));

  h("Quiz + attempts (drive composite Q + first_quiz/quiz_100)");
  const quiz = await admin.from("quizzes").insert({ title: `Mechanics Practice ${ts}`, topic_id: topics[0], course_id: course.id, batch_id: batch.id, duration_min: 20, is_published: true, created_by: teacher.user_id }).select("id").single();
  if (quiz.error) die(`quiz: ${quiz.error.message}`);
  const quizId = quiz.data.id as string;
  const attempt = (student: string, score: number, max: number, agoDays: number) => ({
    quiz_id: quizId, student_id: student,
    started_at: iso(new Date(daysAgo(agoDays).getTime() - 600_000)),
    submitted_at: iso(daysAgo(agoDays)),
    score, max_score: max, correct_count: Math.round((score / max) * 10), wrong_count: 10 - Math.round((score / max) * 10), skipped_count: 0, is_practice: true,
  });
  const attempts = [
    attempt(topper.user_id, 9, 10, 1), attempt(topper.user_id, 10, 10, 0), // recent, high
    attempt(runnerA.user_id, 7, 10, 1),
    attempt(runnerB.user_id, 5, 10, 1),
    attempt(atRisk.user_id, 2, 10, 0), // low, recent
    attempt(streakStar.user_id, 6, 10, 12), // OLD (>7d) -> first_quiz only, no weekly Q
  ];
  // Centurion: 100 backdated submitted quizzes -> quiz_100 (all-time count), weekly Q=0.
  for (let i = 0; i < 100; i++) attempts.push(attempt(centurion.user_id, 5, 10, 20 + i));
  {
    const r = await admin.from("quiz_attempts").insert(attempts);
    if (r.error) die(`quiz_attempts: ${r.error.message}`);
  }

  h("7 consecutive class-days + attendance (perfect_week / early_bird / attendance %)");
  const sessRows = Array.from({ length: 7 }, (_, i) => {
    const start = daysAgo(7 - i);
    start.setHours(10, 0, 0, 0);
    return { batch_id: batch.id, subject_id: subject.id, scheduled_start: iso(start), scheduled_end: iso(new Date(start.getTime() + 90 * 60000)), status: "ended" };
  });
  const sess = await admin.from("sessions").insert(sessRows).select("id, scheduled_start").order("scheduled_start", { ascending: true });
  if (sess.error) die(`sessions: ${sess.error.message}`);
  const sessions = sess.data as { id: string; scheduled_start: string }[];
  const presentCounts: Record<string, number> = {
    [topper.user_id]: 7, [runnerA.user_id]: 5, [runnerB.user_id]: 4, [streakStar.user_id]: 6, [atRisk.user_id]: 1, [centurion.user_id]: 0,
  };
  const att: { session_id: string; student_id: string; status: string; method: string; marked_at: string }[] = [];
  for (const s of all) {
    const present = presentCounts[s.user_id] ?? 0;
    sessions.forEach((se, i) => {
      const isPresent = i < present;
      // Topper scans 5 min EARLY on every present day -> early_bird.
      const markedAt = s.user_id === topper.user_id
        ? iso(new Date(new Date(se.scheduled_start).getTime() - 5 * 60000))
        : iso(new Date(new Date(se.scheduled_start).getTime() + 3 * 60000));
      att.push({ session_id: se.id, student_id: s.user_id, status: isPresent ? "present" : "absent", method: "manual", marked_at: markedAt });
    });
  }
  {
    const r = await admin.from("attendance").insert(att);
    if (r.error) die(`attendance: ${r.error.message}`);
  }

  h("activity_days (drive streaks + composite A)");
  const streakLens: Record<string, number> = {
    [topper.user_id]: 7, [runnerA.user_id]: 5, [runnerB.user_id]: 4, [streakStar.user_id]: 7, [atRisk.user_id]: 0, [centurion.user_id]: 0,
  };
  const days: { student_id: string; day: string }[] = [];
  for (const s of all) {
    const len = streakLens[s.user_id] ?? 0;
    for (let i = 0; i < len; i++) days.push({ student_id: s.user_id, day: istDay(daysAgo(i)) });
  }
  if (days.length > 0) {
    const r = await admin.from("activity_days").upsert(days, { onConflict: "student_id,day", ignoreDuplicates: true });
    if (r.error) die(`activity_days: ${r.error.message}`);
  }

  h("Mastery (mastery_80_subject for Topper + weak topics + at-risk context)");
  const masteryRows = [
    { student_id: topper.user_id, topic_id: topics[0], mastery_pct: 80, attempt_count: 3, updated_at: iso(new Date()) },
    { student_id: topper.user_id, topic_id: topics[1], mastery_pct: 85, attempt_count: 3, updated_at: iso(new Date()) },
    { student_id: topper.user_id, topic_id: topics[2], mastery_pct: 90, attempt_count: 3, updated_at: iso(new Date()) },
    { student_id: runnerA.user_id, topic_id: topics[0], mastery_pct: 72, attempt_count: 2, updated_at: iso(new Date()) },
    { student_id: runnerB.user_id, topic_id: topics[0], mastery_pct: 38, attempt_count: 2, updated_at: iso(new Date()) },
    { student_id: atRisk.user_id, topic_id: topics[0], mastery_pct: 12, attempt_count: 2, updated_at: iso(new Date()) },
    { student_id: streakStar.user_id, topic_id: topics[0], mastery_pct: 55, attempt_count: 2, updated_at: iso(new Date()) },
  ];
  {
    const r = await admin.from("mastery").upsert(masteryRows, { onConflict: "student_id,topic_id" });
    if (r.error) die(`mastery: ${r.error.message}`);
  }

  h("Recompute streaks + evaluate badges + weekly rollover");
  const sr = await admin.rpc("streak_recompute");
  if (sr.error) die(`streak_recompute: ${sr.error.message}`);
  for (const s of all) {
    const ev = await admin.rpc("evaluate_student_badges", { p_student: s.user_id, p_triggers: null });
    if (ev.error) die(`evaluate ${s.email}: ${ev.error.message}`);
  }
  const ro = await admin.rpc("leaderboard_weekly_rollover", { p_period_start: null, p_batch: batch.id });
  if (ro.error) die(`rollover: ${ro.error.message}`);
  info(`streaks recomputed; badges evaluated; rollover snapshotted ${ro.data} batch(es)`);

  h("Curate celebrations (one crisp unseen badge each for 3 students)");
  // Mark every earned badge seen, then re-open one per demo student so the celebration
  // modal fires exactly once on first focus.
  await admin.from("badge_earnings").update({ is_seen: true }).in("student_id", all.map((s) => s.user_id));
  const badgeId = async (code: string) => (await admin.from("badges").select("id").eq("code", code).single()).data!.id as string;
  const topperBadge = await badgeId("topper_of_week");
  const streak7Badge = await badgeId("streak_7");
  const quiz100Badge = await badgeId("quiz_100");
  await admin.from("badge_earnings").update({ is_seen: false }).eq("student_id", topper.user_id).eq("badge_id", topperBadge);
  await admin.from("badge_earnings").update({ is_seen: false }).eq("student_id", streakStar.user_id).eq("badge_id", streak7Badge);
  await admin.from("badge_earnings").update({ is_seen: false }).eq("student_id", centurion.user_id).eq("badge_id", quiz100Badge);

  // Report the final board so the summary's ranks are accurate.
  const board = await admin
    .from("leaderboard_weekly")
    .select("student_id, composite")
    .eq("batch_id", batch.id);
  const compById = new Map<string, number>();
  for (const r of (board.data ?? []) as { student_id: string; composite: number }[]) compById.set(r.student_id, Number(r.composite));
  const comp = (id: string) => (compById.get(id) ?? 0).toFixed(2);

  h("Summary");
  console.log(`
Course:   ${courseCode}   Batch: P10_A_${ts} (${batch.id})

Teacher (open the batch -> Risk tab)
  Email     ${teacher.email}
  Password  ${teacher.initial_password}
  -> At-risk list: "At Risk" (~0.12) + "Centurion" (~0.00) below the 0.40 composite line.

Student "Topper"        ${topper.email} / ${topper.initial_password}
  -> Leaderboard #1 (composite ~${comp(topper.user_id)}). On login: "Top of the Class" celebration.
     Profile -> Badges: First Step, Week Warrior, Showed Up, Early Bird, Subject Specialist, Top of the Class.
Student "Runner Up A"   ${runnerA.email} / ${runnerA.initial_password}
  -> Leaderboard #2 (~${comp(runnerA.user_id)}); badge "So Close" (runner-up).
Student "Runner Up B"   ${runnerB.email} / ${runnerB.initial_password}
  -> Leaderboard #3 (~${comp(runnerB.user_id)}); badge "So Close" (runner-up).
Student "Streak Star"   ${streakStar.email} / ${streakStar.initial_password}
  -> 7-day streak (orange flame), mid-board (~${comp(streakStar.user_id)}). On login: "Week Warrior" celebration.
Student "At Risk"       ${atRisk.email} / ${atRisk.initial_password}
  -> composite ~${comp(atRisk.user_id)} (< 0.40), grey ember flame; appears in teacher at-risk list.
Student "Centurion"     ${centurion.email} / ${centurion.initial_password}
  -> 100-quiz history -> "Centurion" badge. On login: "Centurion" celebration. Composite ~${comp(centurion.user_id)}.

Re-run with \`pnpm seed:leaderboard-manual-test --reset\` to wipe prior p10-* fixtures.
`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
