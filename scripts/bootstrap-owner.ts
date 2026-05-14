// scripts/bootstrap-owner.ts
//
// One-time idempotent script to create the first owner_admin user.
// After this runs once, every other admin is created via the admin
// panel UI (CP7's /students/new style flow, for admins). Never check
// OWNER_INITIAL_PASSWORD into git. Never commit a .env file.
//
// Run from repo root:
//   $env:OWNER_EMAIL='you@example.com'
//   $env:OWNER_INITIAL_PASSWORD='at-least-10-chars'
//   $env:OWNER_FULL_NAME='Your Full Name'
//   pnpm bootstrap:owner
//
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are read from apps/admin/.env.local.
// You can override either inline as an env-var too.

import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({
  path: resolve(__dirname, "..", "apps", "admin", ".env.local"),
  override: false,
});

const EnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(20, "SUPABASE_SERVICE_ROLE_KEY looks too short — it must be the secret service-role key, not the anon key"),
  OWNER_EMAIL: z.string().email(),
  OWNER_INITIAL_PASSWORD: z
    .string()
    .min(10, "OWNER_INITIAL_PASSWORD must be at least 10 chars"),
  OWNER_FULL_NAME: z.string().min(2).max(100),
});

function fail(msg: string): never {
  process.stderr.write(`bootstrap-owner: ${msg}\n`);
  process.exit(1);
}

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("\n");
  fail(
    [
      "missing or invalid environment:",
      issues,
      "",
      "Required vars:",
      "  NEXT_PUBLIC_SUPABASE_URL       (read from apps/admin/.env.local)",
      "  SUPABASE_SERVICE_ROLE_KEY      (read from apps/admin/.env.local — must be the SECRET service-role key)",
      "  OWNER_EMAIL                    (pass inline)",
      "  OWNER_INITIAL_PASSWORD         (pass inline; >= 10 chars)",
      "  OWNER_FULL_NAME                (pass inline)",
    ].join("\n"),
  );
}
const env = parsed.data;

const admin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

async function findAuthUserByEmail(email: string) {
  const target = email.toLowerCase();
  const { data, error } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (error) throw error;
  return data.users.find((u) => u.email?.toLowerCase() === target) ?? null;
}

async function main() {
  console.log(`bootstrap-owner: target = ${env.OWNER_EMAIL}`);

  // 1. ensure auth.users row exists.
  let authUserId: string;
  const existingAuth = await findAuthUserByEmail(env.OWNER_EMAIL);
  if (existingAuth) {
    authUserId = existingAuth.id;
    console.log(
      `bootstrap-owner: auth.users already has this email (id=${authUserId}) — skipping createUser`,
    );
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: env.OWNER_EMAIL,
      password: env.OWNER_INITIAL_PASSWORD,
      email_confirm: true,
    });
    if (error || !data.user) {
      fail(`createUser failed: ${error?.message ?? "unknown"}`);
    }
    authUserId = data.user.id;
    console.log(`bootstrap-owner: created auth.users id=${authUserId}`);
  }

  // 2. ensure public.app_users row exists.
  const { data: existingAppUser, error: lookupErr } = await admin
    .from("app_users")
    .select("id")
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  if (lookupErr) fail(`app_users lookup failed: ${lookupErr.message}`);

  let appUserId: string;
  if (existingAppUser) {
    appUserId = existingAppUser.id;
    console.log(
      `bootstrap-owner: app_users row already exists (id=${appUserId}) — skipping insert`,
    );
  } else {
    const { data: inserted, error: insertErr } = await admin
      .from("app_users")
      .insert({
        auth_user_id: authUserId,
        full_name: env.OWNER_FULL_NAME,
        email: env.OWNER_EMAIL,
        is_active: true,
        must_change_password: true,
      })
      .select("id")
      .single();
    if (insertErr || !inserted) {
      fail(`app_users insert failed: ${insertErr?.message ?? "unknown"}`);
    }
    appUserId = inserted.id;
    console.log(`bootstrap-owner: inserted app_users id=${appUserId}`);
  }

  // 3. ensure user_roles owner_admin row exists.
  const { data: existingRole, error: roleLookupErr } = await admin
    .from("user_roles")
    .select("user_id")
    .eq("user_id", appUserId)
    .eq("role", "owner_admin")
    .maybeSingle();
  if (roleLookupErr) fail(`user_roles lookup failed: ${roleLookupErr.message}`);

  if (existingRole) {
    console.log(`bootstrap-owner: owner_admin role already granted — skipping`);
  } else {
    const { error: roleInsertErr } = await admin
      .from("user_roles")
      .insert({
        user_id: appUserId,
        role: "owner_admin",
        // granted_by is null on bootstrap: no other admin existed yet.
      });
    if (roleInsertErr) fail(`user_roles insert failed: ${roleInsertErr.message}`);
    console.log(`bootstrap-owner: granted owner_admin to ${appUserId}`);
  }

  // 4. one-time audit_log entry recording the bootstrap.
  const { data: existingAudit, error: auditLookupErr } = await admin
    .from("audit_log")
    .select("id")
    .eq("action", "bootstrap_owner")
    .eq("entity_table", "app_users")
    .eq("entity_id", appUserId)
    .maybeSingle();
  if (auditLookupErr) fail(`audit_log lookup failed: ${auditLookupErr.message}`);

  if (!existingAudit) {
    const { error: auditErr } = await admin.from("audit_log").insert({
      actor_user_id: appUserId,
      actor_role: "owner_admin",
      action: "bootstrap_owner",
      entity_table: "app_users",
      entity_id: appUserId,
      before_data: null,
      after_data: {
        full_name: env.OWNER_FULL_NAME,
        email: env.OWNER_EMAIL,
        role: "owner_admin",
        must_change_password: true,
      },
    });
    if (auditErr) fail(`audit_log insert failed: ${auditErr.message}`);
    console.log(`bootstrap-owner: wrote audit_log entry`);
  } else {
    console.log(`bootstrap-owner: audit_log entry already present — skipping`);
  }

  console.log("");
  console.log(`bootstrap-owner: DONE.`);
  console.log(`  email      ${env.OWNER_EMAIL}`);
  console.log(`  app_users  ${appUserId}`);
  console.log(`  auth_user  ${authUserId}`);
  console.log(`  role       owner_admin`);
  console.log("");
  console.log(
    `Next step: once CP6 ships the admin login page, log in at the admin panel`,
  );
  console.log(
    `with this email + initial password. You will be forced to change the`,
  );
  console.log(`password and enroll TOTP before reaching the dashboard.`);
}

main().catch((err) => {
  fail(err instanceof Error ? (err.stack ?? err.message) : String(err));
});
