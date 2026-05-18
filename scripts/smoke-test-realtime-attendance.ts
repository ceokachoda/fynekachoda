// scripts/smoke-test-realtime-attendance.ts
//
// Phase 4 CP8 — proves Postgres CDC on `public.attendance` reaches an
// authorized teacher subscriber.
//   * subscribe with the teacher's JWT to postgres_changes on attendance,
//     filtered to a freshly-created session_id
//   * INSERT an attendance row via service-role
//   * receive the INSERT payload within 10 s
//   * confirm the payload's student_id matches what we just inserted
//
//   pnpm smoke:realtime

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

function header(name: string): void {
  console.log(`\n=== ${name} ===`);
}

function pass(msg: string): void {
  console.log(`  PASS  ${msg}`);
}

function fail(msg: string): never {
  console.error(`  FAIL  ${msg}`);
  process.exit(1);
}

async function callFn(
  name: string,
  body: unknown,
  jwt: string,
): Promise<{ status: number; body: Record<string, unknown> }> {
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

async function signIn(email: string, password: string): Promise<string> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) fail(`signIn ${email}: ${res.status} ${JSON.stringify(data)}`);
  return data.access_token as string;
}

interface BootstrappedUser {
  user_id: string;
  email: string;
  initial_password: string;
}

async function bootstrap(
  role: "student" | "teacher",
  label: string,
  ts: number,
  ownerJwt: string,
  batchId?: string,
): Promise<BootstrappedUser> {
  const email = `cp8-${role}-${label}-${ts}@fynestudy.example.com`;
  const payload: Record<string, unknown> =
    role === "student"
      ? {
          role,
          full_name: `CP8 S ${label}`,
          email,
          batch_id: batchId,
          parent_consent_method: "verbal",
          school_name: "CP8 Test School",
          board: "CBSE",
          current_class: "12",
        }
      : {
          role,
          full_name: `CP8 T ${label}`,
          email,
          subjects: ["physics"],
        };
  const res = await callFn("auth-bootstrap", payload, ownerJwt);
  if (res.status !== 200) {
    fail(`bootstrap ${role} ${label}: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body as unknown as BootstrappedUser;
}

async function main(): Promise<void> {
  const ts = Date.now();
  header("Setup — owner JWT + fixtures");
  const ownerJwt = await signIn(OWNER_EMAIL, OWNER_PASSWORD);
  const admin: SupabaseClient = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: jeeCourse } = await admin
    .from("courses")
    .select("id")
    .eq("code", "JEE_MAIN")
    .single();
  const { data: batch } = await admin
    .from("batches")
    .insert({
      course_id: jeeCourse!.id,
      name: `CP8 Batch ${ts}`,
      starts_on: "2026-01-01",
      capacity: 80,
    })
    .select("id")
    .single();
  const batchId = batch!.id as string;
  const s1 = await bootstrap("student", "1", ts, ownerJwt, batchId);
  const s2 = await bootstrap("student", "2", ts, ownerJwt, batchId);
  const t1 = await bootstrap("teacher", "T1", ts, ownerJwt);
  const t1Jwt = await signIn(t1.email, t1.initial_password);
  await admin
    .from("batch_teachers")
    .insert({ batch_id: batchId, teacher_id: t1.user_id });
  const { data: sess } = await admin
    .from("sessions")
    .insert({
      batch_id: batchId,
      scheduled_start: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      scheduled_end: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    })
    .select("id")
    .single();
  const sessionId = sess!.id as string;
  pass(
    `Batch ${batchId.slice(0, 8)}…, T1 assigned, Session ${sessionId.slice(0, 8)}…, Student ${s1.user_id.slice(0, 8)}…`,
  );

  async function subscribeAndWait(
    label: string,
    client: SupabaseClient,
    filter: string | undefined,
    studentId: string,
  ): Promise<Record<string, unknown> | null> {
    let received: Record<string, unknown> | null = null;
    const ch = client
      .channel(`cp8-${label}-${sessionId}-${Date.now()}`)
      .on(
        "postgres_changes",
        filter
          ? { event: "INSERT", schema: "public", table: "attendance", filter }
          : { event: "INSERT", schema: "public", table: "attendance" },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          if (!filter || row.session_id === sessionId) received = row;
        },
      );

    await new Promise<void>((res, rej) => {
      const t = setTimeout(
        () => rej(new Error(`subscribe timed out after 15s (${label})`)),
        15_000,
      );
      ch.subscribe((status, err) => {
        if (status === "SUBSCRIBED") {
          clearTimeout(t);
          res();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          clearTimeout(t);
          rej(new Error(`subscribe ${label}: ${status}: ${err?.message ?? "unknown"}`));
        }
      });
    });

    const { error: insertErr } = await admin
      .from("attendance")
      .insert({
        session_id: sessionId,
        student_id: studentId,
        status: "present",
        method: "manual",
        marked_by: t1.user_id,
      });
    if (insertErr) {
      await client.removeChannel(ch).catch(() => {});
      fail(`attendance INSERT (${label}): ${insertErr.message}`);
    }

    const event = await new Promise<Record<string, unknown> | null>((res) => {
      const start = Date.now();
      const poll = setInterval(() => {
        if (received) {
          clearInterval(poll);
          res(received);
        } else if (Date.now() - start > 30_000) {
          clearInterval(poll);
          res(null);
        }
      }, 100);
    });

    await client.removeChannel(ch).catch(() => {});
    return event;
  }

  header("Test 1 — service-role subscriber receives the CDC event (no RLS gate)");
  const adminRealtime: SupabaseClient = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  adminRealtime.realtime.setAuth(SERVICE_KEY);
  const adminEvent = await subscribeAndWait(
    "admin",
    adminRealtime,
    undefined,
    s1.user_id,
  );
  if (!adminEvent) {
    fail(
      `service-role subscriber received no CDC event in 30s — publication or worker problem`,
    );
  }
  if (
    adminEvent.session_id !== sessionId ||
    adminEvent.student_id !== s1.user_id ||
    adminEvent.status !== "present"
  ) {
    fail(`service-role CDC event payload wrong: ${JSON.stringify(adminEvent)}`);
  }
  pass(
    `service-role got INSERT event: session=${(adminEvent.session_id as string).slice(0, 8)}…, student=${(adminEvent.student_id as string).slice(0, 8)}…, status=${adminEvent.status}`,
  );

  header("Test 2 — teacher JWT subscriber receives the SAME row (RLS-allowed)");
  const teacherClient: SupabaseClient = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  teacherClient.realtime.setAuth(t1Jwt);
  const teacherEvent = await subscribeAndWait(
    "teacher",
    teacherClient,
    `session_id=eq.${sessionId}`,
    s2.user_id,
  );
  if (!teacherEvent) {
    fail(
      `teacher JWT subscriber received no CDC event in 30s — RLS-at-broadcast may be blocking`,
    );
  }
  if (
    teacherEvent.session_id !== sessionId ||
    teacherEvent.student_id !== s2.user_id
  ) {
    fail(`teacher CDC event payload wrong: ${JSON.stringify(teacherEvent)}`);
  }
  pass(`teacher CDC event received under RLS-allowed scope (student=S2)`);

  console.log(`\nALL Realtime CDC SMOKE TESTS PASSED.`);
  process.exit(0);
}

main().catch((err) => {
  fail(err instanceof Error ? (err.stack ?? err.message) : String(err));
});
