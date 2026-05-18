// scripts/seed-manual-test.ts
//
// One-shot fixture for hands-on testing of the Phase 4 CP10 teacher flows.
// Creates: 1 batch, 1 teacher (assigned), 2 students (in batch), 1 session
// that is OPEN RIGHT NOW (start = now-5min, end = now+120min).
//
// All three users are bootstrapped with their must_change_password set to
// false so login lands on the home tab directly. Use the printed credentials
// to sign into Expo Go on two devices (or browser web target if you prefer).
//
//   pnpm seed:manual-test
//
// Re-running creates a fresh set with a new timestamp suffix — old fixtures
// are NOT deleted (you can keep using them too).

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

async function callFn(
  name: string,
  body: unknown,
  jwt: string | null,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (jwt) headers.Authorization = `Bearer ${jwt}`;
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: res.status, body: data };
}

async function signIn(email: string, password: string): Promise<string> {
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
): Promise<{ user_id: string; email: string; initial_password: string }> {
  const res = await callFn("auth-bootstrap", payload, ownerJwt);
  if (res.status !== 200) {
    throw new Error(
      `bootstrap failed: ${res.status} ${JSON.stringify(res.body)}`,
    );
  }
  const body = res.body as { user_id: string; email: string; initial_password: string };
  // Skip the forced password-change screen so login goes straight to home.
  await admin
    .from("app_users")
    .update({ must_change_password: false })
    .eq("id", body.user_id);
  return body;
}

async function main(): Promise<void> {
  const ts = Date.now();
  const label = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

  console.log(`Seeding manual-test fixtures (label ${label})…`);
  console.log("");

  const ownerJwt = await signIn(OWNER_EMAIL, OWNER_PASSWORD);
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: course } = await admin
    .from("courses")
    .select("id, code, name")
    .eq("code", "JEE_MAIN")
    .single();
  if (!course) throw new Error("JEE_MAIN course not found — seed Phase 3 first");

  const batchName = `Manual Test ${label}`;
  const { data: batch, error: batchErr } = await admin
    .from("batches")
    .insert({
      course_id: course.id,
      name: batchName,
      starts_on: "2026-01-01",
      capacity: 30,
      is_active: true,
    })
    .select("id, name")
    .single();
  if (batchErr || !batch) throw new Error(`batch insert: ${batchErr?.message}`);

  const teacher = await bootstrap(admin, ownerJwt, {
    role: "teacher",
    full_name: `Test Teacher ${label}`,
    email: `manual-teacher-${ts}@fynestudy.example.com`,
    subjects: ["physics"],
  });

  await admin
    .from("batch_teachers")
    .insert({ batch_id: batch.id, teacher_id: teacher.user_id });

  const student1 = await bootstrap(admin, ownerJwt, {
    role: "student",
    full_name: `Test Student One ${label}`,
    email: `manual-student-1-${ts}@fynestudy.example.com`,
    batch_id: batch.id,
    parent_consent_method: "verbal",
    school_name: "Manual Test School",
    board: "CBSE",
    current_class: "12",
  });

  const student2 = await bootstrap(admin, ownerJwt, {
    role: "student",
    full_name: `Test Student Two ${label}`,
    email: `manual-student-2-${ts}@fynestudy.example.com`,
    batch_id: batch.id,
    parent_consent_method: "verbal",
    school_name: "Manual Test School",
    board: "CBSE",
    current_class: "12",
  });

  // Session that starts 5 min ago and ends 2 hours from now.
  // This puts us inside the "present" band (now - start <= 10 min) so a
  // QR scan should produce status='present' rather than 'late'.
  const start = new Date(Date.now() - 5 * 60 * 1000);
  const end = new Date(Date.now() + 120 * 60 * 1000);
  const { data: sess, error: sessErr } = await admin
    .from("sessions")
    .insert({
      batch_id: batch.id,
      scheduled_start: start.toISOString(),
      scheduled_end: end.toISOString(),
      created_by: teacher.user_id,
    })
    .select("id")
    .single();
  if (sessErr || !sess) throw new Error(`session insert: ${sessErr?.message}`);

  // Also create an upcoming session so the Classes tab has something in
  // both Today and Upcoming.
  const tomorrowStart = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const tomorrowEnd = new Date(tomorrowStart.getTime() + 60 * 60 * 1000);
  const { data: futureSess } = await admin
    .from("sessions")
    .insert({
      batch_id: batch.id,
      scheduled_start: tomorrowStart.toISOString(),
      scheduled_end: tomorrowEnd.toISOString(),
      created_by: teacher.user_id,
    })
    .select("id")
    .single();

  const istTime = (d: Date) =>
    d.toLocaleTimeString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
    });
  const istDate = (d: Date) =>
    d.toLocaleDateString("en-IN", {
      timeZone: "Asia/Kolkata",
      weekday: "short",
      day: "numeric",
      month: "short",
    });

  console.log("================================================================");
  console.log("  Manual-test fixtures READY");
  console.log("================================================================");
  console.log("");
  console.log(`  Batch name:        ${batch.name}`);
  console.log(`  Batch id:          ${batch.id}`);
  console.log(`  Course:            ${course.code} (${course.name})`);
  console.log("");
  console.log("  ── TEACHER ──");
  console.log(`  Email:             ${teacher.email}`);
  console.log(`  Password:          ${teacher.initial_password}`);
  console.log(`  (must_change_password is OFF — lands on home directly)`);
  console.log("");
  console.log("  ── STUDENT 1 ──");
  console.log(`  Email:             ${student1.email}`);
  console.log(`  Password:          ${student1.initial_password}`);
  console.log("");
  console.log("  ── STUDENT 2 ──");
  console.log(`  Email:             ${student2.email}`);
  console.log(`  Password:          ${student2.initial_password}`);
  console.log("");
  console.log("  ── SESSION (OPEN NOW) ──");
  console.log(`  Session id:        ${sess.id}`);
  console.log(`  IST start → end:   ${istDate(start)} · ${istTime(start)} → ${istTime(end)}`);
  console.log(`  Scan window:       open for the next ~2 hours`);
  console.log(`  Status band:       'present' for next ~5 min, 'late' for ~25 min after that`);
  console.log("");
  console.log("  ── SESSION (TOMORROW, upcoming) ──");
  console.log(`  Session id:        ${futureSess?.id}`);
  console.log(`  IST start → end:   ${istDate(tomorrowStart)} · ${istTime(tomorrowStart)} → ${istTime(tomorrowEnd)}`);
  console.log("");
  console.log("================================================================");
  console.log("  Next: run `pnpm dev:mobile` and sign in on Expo Go.");
  console.log("================================================================");
}

main().catch((err) => {
  console.error("FAILED:", err instanceof Error ? err.stack : err);
  process.exit(1);
});
