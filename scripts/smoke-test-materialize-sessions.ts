// scripts/smoke-test-materialize-sessions.ts
//
// Phase 4 CP7 — proves `public.materialize_sessions` is idempotent:
//   * fresh batch + 3 weekly schedule rows
//   * call materialize_sessions(14)         → some sessions inserted
//   * count sessions for our batch          → N rows
//   * call materialize_sessions(14) again   → returns 0 new rows
//   * count sessions for our batch          → still N rows
//   * verify session times are IST 09:00 / 10:00 wall-clock
//
//   pnpm smoke:materialize

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
const SERVICE_KEY = required("SUPABASE_SERVICE_ROLE_KEY");

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

async function main(): Promise<void> {
  const ts = Date.now();
  const admin: SupabaseClient = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  header("Setup — fresh test batch with no sessions yet");
  const { data: jeeCourse } = await admin
    .from("courses")
    .select("id")
    .eq("code", "JEE_MAIN")
    .single();
  const { data: batch, error: batchErr } = await admin
    .from("batches")
    .insert({
      course_id: jeeCourse!.id,
      name: `CP7 Batch ${ts}`,
      starts_on: "2026-01-01",
      capacity: 80,
    })
    .select("id")
    .single();
  if (batchErr || !batch) fail(`create batch: ${batchErr?.message}`);
  const batchId = batch.id as string;
  pass(`Batch ${batchId.slice(0, 8)}…`);

  header("Setup — 3 batch_schedule rows (weekdays Mon/Wed/Fri, 09:00–10:00 IST)");
  const { error: schedErr } = await admin.from("batch_schedule").insert([
    { batch_id: batchId, weekday: 1, start_time: "09:00", end_time: "10:00", is_active: true },
    { batch_id: batchId, weekday: 3, start_time: "09:00", end_time: "10:00", is_active: true },
    { batch_id: batchId, weekday: 5, start_time: "09:00", end_time: "10:00", is_active: true },
  ]);
  if (schedErr) fail(`batch_schedule insert: ${schedErr.message}`);
  pass(`3 schedule rows inserted`);

  header("Test 1 — first materialize_sessions(14) call inserts > 0 rows for our batch");
  const { error: callErr1 } = await admin.rpc("materialize_sessions", { p_days: 14 });
  if (callErr1) fail(`materialize call 1: ${callErr1.message}`);

  const { data: sess1, error: countErr1 } = await admin
    .from("sessions")
    .select("id, scheduled_start, scheduled_end")
    .eq("batch_id", batchId);
  if (countErr1) fail(`count sessions: ${countErr1.message}`);
  const firstCount = sess1!.length;
  if (firstCount === 0) {
    fail(`expected > 0 sessions for our batch after first call, got 0`);
  }
  pass(`first call: our batch now has ${firstCount} sessions in next 14 days`);

  header("Test 2 — IST 09:00 wall-clock check on the first session");
  // Decode scheduled_start back to IST and confirm it's 09:00.
  const istHourStart = new Date(sess1![0].scheduled_start)
    .toLocaleString("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false });
  const istHourEnd = new Date(sess1![0].scheduled_end)
    .toLocaleString("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false });
  if (!istHourStart.startsWith("09:00")) {
    fail(`expected scheduled_start IST 09:00, got ${istHourStart}`);
  }
  if (!istHourEnd.startsWith("10:00")) {
    fail(`expected scheduled_end IST 10:00, got ${istHourEnd}`);
  }
  pass(`session[0] IST window = ${istHourStart} → ${istHourEnd}`);

  header("Test 3 — second call returns 0 new rows globally (idempotent)");
  const { data: returned2, error: callErr2 } = await admin.rpc(
    "materialize_sessions",
    { p_days: 14 },
  );
  if (callErr2) fail(`materialize call 2: ${callErr2.message}`);
  if (returned2 !== 0) {
    fail(`expected return=0 on idempotent re-run, got ${returned2}`);
  }
  pass(`materialize_sessions returned ${returned2} (no new rows)`);

  header("Test 4 — session count for our batch unchanged after re-run");
  const { data: sess2 } = await admin
    .from("sessions")
    .select("id")
    .eq("batch_id", batchId);
  const secondCount = sess2!.length;
  if (secondCount !== firstCount) {
    fail(`expected count unchanged at ${firstCount}, got ${secondCount}`);
  }
  pass(`our batch still has ${secondCount} sessions (no duplicates)`);

  // Cron job state lives in `cron.job` (the pg_cron extension schema) which
  // isn't exposed to PostgREST. Verified separately via MCP `execute_sql`
  // against `cron.job`: jobid=1, schedule='0 19 * * *' (00:30 IST nightly),
  // active=true. Recorded in the CP7 acceptance ledger.

  console.log(`\nALL materialize_sessions SMOKE TESTS PASSED.`);
  console.log(`Fixtures (left in place):`);
  console.log(`  Batch:        ${batchId} (3 weekly schedule rows, ${firstCount} sessions in 14d)`);
}

main().catch((err) => {
  fail(err instanceof Error ? (err.stack ?? err.message) : String(err));
});
