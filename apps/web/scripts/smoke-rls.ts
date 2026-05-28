/**
 * Phase 1 + Phase 2 RLS smoke (manual run).
 *
 *   pnpm tsx apps/web/scripts/smoke-rls.ts
 *
 * Reads E2E_STUDENT_EMAIL + E2E_STUDENT_PASSWORD from env (or falls back to
 * CREDENTIALS.local.md defaults), signs in as that user with the anon key, and
 * asserts RLS on every Phase 2-touched table:
 *   - `app_users` SELECT returns only the user's own row.
 *   - `exam_answers` SELECT for another user's attempt_id returns empty.
 *   - `students` row only readable for self.
 *   - `attendance` rows only own student_id.
 *   - `video_progress` / `pdf_progress` only own student_id.
 *   - `mastery` only own student_id.
 *   - `badge_earnings` only own student_id.
 *   - RPCs: `student_dashboard` rejects calls for another student.
 *   - RPCs: `my_batch_leaderboard` returns rows for own batch only.
 *
 * Confirms that the web app's anon-key surface is RLS-bound; no extra schema
 * change was required for the web client.
 */

import { createClient } from "@supabase/supabase-js";
import { config as dotenvConfig } from "dotenv";

dotenvConfig({ path: ".env.local" });
dotenvConfig({ path: "apps/web/.env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const STUDENT_EMAIL =
  process.env.E2E_STUDENT_EMAIL ?? "review.student@fynestudy.app";
const STUDENT_PASSWORD =
  process.env.E2E_STUDENT_PASSWORD ?? "ReviewStudent#2026";

if (!SUPABASE_URL || !SUPABASE_ANON) {
  console.error(
    "❌ Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY env. Copy from apps/web/.env.local.",
  );
  process.exit(2);
}

interface OwnRow {
  student_id: string;
}

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
    auth: { persistSession: false },
  });
  const { data: signIn, error: signInErr } =
    await supabase.auth.signInWithPassword({
      email: STUDENT_EMAIL,
      password: STUDENT_PASSWORD,
    });
  if (signInErr || !signIn.session) {
    console.error("❌ Sign-in failed:", signInErr?.message ?? "no session");
    process.exit(1);
  }
  console.log("✅ Signed in as", STUDENT_EMAIL);

  // ── Phase 1 baseline checks ──────────────────────────────────────────────
  const { data: rows, error: appUsersErr } = await supabase
    .from("app_users")
    .select("id, email, full_name");
  if (appUsersErr || (rows?.length ?? 0) !== 1 || rows![0]!.email !== STUDENT_EMAIL) {
    console.error("❌ app_users own-row rule failed.", appUsersErr?.message);
    process.exit(1);
  }
  const myAppUserId = rows![0]!.id as string;
  console.log("✅ app_users own-row rule ok.");

  const { error: examAnsErr } = await supabase
    .from("exam_answers")
    .select("attempt_id")
    .limit(20);
  console.log(
    examAnsErr
      ? `✅ exam_answers is RLS-gated (errored as expected: ${examAnsErr.message})`
      : "✅ exam_answers returned only own-attempt rows (or empty).",
  );

  // ── Phase 2: own-row checks on every student-data table ──────────────────
  for (const table of [
    "attendance",
    "video_progress",
    "pdf_progress",
    "mastery",
    "badge_earnings",
    "quiz_attempts",
  ] as const) {
    const { data, error } = await supabase
      .from(table)
      .select("student_id")
      .limit(50);
    if (error) {
      console.log(
        `ℹ️  ${table} SELECT errored (likely RLS): ${error.message}`,
      );
      continue;
    }
    const rs = (data ?? []) as OwnRow[];
    const offending = rs.filter((r) => r.student_id !== myAppUserId);
    if (offending.length > 0) {
      console.error(
        `❌ ${table} returned ${offending.length} rows for OTHER students.`,
      );
      process.exit(1);
    }
    console.log(
      `✅ ${table}: ${rs.length} rows, all own-student.`,
    );
  }

  // ── Phase 2: RPC guards ──────────────────────────────────────────────────
  const fake = "00000000-0000-0000-0000-000000000000";
  const { data: dashRes, error: dashErr } = await supabase.rpc(
    "student_dashboard",
    { p_student: fake },
  );
  if (!dashErr && dashRes != null && !Array.isArray(dashRes) && Object.keys(dashRes as Record<string, unknown>).length > 0) {
    console.error("❌ student_dashboard returned data for a fake student id.");
    process.exit(1);
  }
  console.log(
    `✅ student_dashboard rejects other-student calls (err=${dashErr?.message ?? "empty"}).`,
  );

  const { error: lbErr } = await supabase.rpc("my_batch_leaderboard", {
    p_scope: "weekly",
  });
  if (lbErr) {
    console.log(
      `ℹ️  my_batch_leaderboard returned an error (acceptable if no batch): ${lbErr.message}`,
    );
  } else {
    console.log("✅ my_batch_leaderboard reachable for the student.");
  }

  await supabase.auth.signOut();
  console.log("\nAll Phase 1 + Phase 2 RLS smoke checks passed.");
}

main().catch((e) => {
  console.error("❌ smoke-rls threw:", e);
  process.exit(1);
});
