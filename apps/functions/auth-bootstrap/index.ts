import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { handlePreflight } from "../_shared/cors.ts";
import { json, jsonError } from "../_shared/response.ts";
import { getServiceRoleClient } from "../_shared/supabase.ts";
import { AuthError, adminRoleFor, loadCaller, requireAnyRole } from "../_shared/auth.ts";
import { clientIp, writeAudit } from "../_shared/audit.ts";
import { generateTempPassword } from "../_shared/password.ts";
import { BootstrapInputSchema } from "../_shared/schemas.ts";

Deno.serve(async (req: Request) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  const origin = req.headers.get("Origin");

  if (req.method !== "POST") {
    return jsonError(405, "method not allowed", origin);
  }

  try {
    const caller = await loadCaller(req);

    const rawBody = await req.json().catch(() => null);
    if (rawBody === null) return jsonError(400, "invalid JSON body", origin);

    const parsed = BootstrapInputSchema.safeParse(rawBody);
    if (!parsed.success) {
      return jsonError(400, "validation failed", origin, parsed.error.issues);
    }
    const input = parsed.data;

    // Authorization tiers:
    //   - creating an admin (owner or staff): caller must be owner_admin.
    //   - creating teacher or student: caller must be any admin.
    if (input.role === "owner_admin" || input.role === "staff_admin") {
      requireAnyRole(caller, ["owner_admin"]);
    } else {
      requireAnyRole(caller, ["owner_admin", "staff_admin"]);
    }

    const admin = getServiceRoleClient();

    // Up-front duplicate check produces a clean 409 instead of a Postgres
    // unique-violation surfaced as 500.
    const { data: existing, error: existingErr } = await admin
      .from("app_users")
      .select("id")
      .eq("email", input.email)
      .maybeSingle();
    if (existingErr) {
      return jsonError(500, "db lookup failed", origin, existingErr.message);
    }
    if (existing) return jsonError(409, "email already in use", origin);

    const initialPassword = generateTempPassword();

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: input.email,
      password: initialPassword,
      email_confirm: true,
    });
    if (createErr || !created.user) {
      return jsonError(500, "createUser failed", origin, createErr?.message);
    }
    const authUserId = created.user.id;

    const { data: appUser, error: appUserErr } = await admin
      .from("app_users")
      .insert({
        auth_user_id: authUserId,
        full_name: input.full_name,
        email: input.email,
        phone: "phone" in input ? (input.phone ?? null) : null,
        dob: "dob" in input ? (input.dob ?? null) : null,
        gender: "gender" in input ? (input.gender ?? null) : null,
        is_active: true,
        must_change_password: true,
      })
      .select("id")
      .single();
    if (appUserErr || !appUser) {
      await admin.auth.admin.deleteUser(authUserId).catch(() => {});
      return jsonError(
        500,
        "app_users insert failed",
        origin,
        appUserErr?.message,
      );
    }
    const appUserId = appUser.id;

    const { error: roleErr } = await admin.from("user_roles").insert({
      user_id: appUserId,
      role: input.role,
      granted_by: caller.app_user_id,
    });
    if (roleErr) {
      return jsonError(500, "user_roles insert failed", origin, roleErr.message);
    }

    if (input.role === "student") {
      const { error: studentErr } = await admin.from("students").insert({
        user_id: appUserId,
        school_name: input.school_name ?? null,
        board: input.board ?? null,
        current_class: input.current_class ?? null,
        address: input.address ?? null,
        parent_phone_1: input.parent_phone_1 ?? null,
        parent_phone_2: input.parent_phone_2 ?? null,
        parent_consent_method: input.parent_consent_method ?? null,
        parent_consent_at: input.parent_consent_method
          ? new Date().toISOString()
          : null,
        parent_consent_by: input.parent_consent_method
          ? caller.app_user_id
          : null,
      });
      if (studentErr) {
        return jsonError(500, "students insert failed", origin, studentErr.message);
      }
    } else if (input.role === "teacher") {
      const { error: teacherErr } = await admin.from("teachers").insert({
        user_id: appUserId,
        subjects: input.subjects ?? [],
        bio: input.bio ?? null,
      });
      if (teacherErr) {
        return jsonError(500, "teachers insert failed", origin, teacherErr.message);
      }
    }

    await writeAudit(admin, {
      actor_user_id: caller.app_user_id,
      actor_role: adminRoleFor(caller),
      action: "create_user",
      entity_table: "app_users",
      entity_id: appUserId,
      before_data: null,
      after_data: {
        full_name: input.full_name,
        email: input.email,
        role: input.role,
        must_change_password: true,
      },
      ip_address: clientIp(req),
      user_agent: req.headers.get("user-agent"),
    });

    return json(
      200,
      {
        user_id: appUserId,
        auth_user_id: authUserId,
        email: input.email,
        role: input.role,
        initial_password: initialPassword,
      },
      origin,
    );
  } catch (err) {
    if (err instanceof AuthError) {
      return jsonError(err.status, err.message, origin);
    }
    console.error("auth-bootstrap error:", err);
    return jsonError(500, "internal error", origin);
  }
});
