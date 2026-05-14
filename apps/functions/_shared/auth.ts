import { getServiceRoleClient, getUserClient } from "./supabase.ts";

export interface CallerContext {
  auth_user_id: string;
  app_user_id: string;
  email: string;
  full_name: string;
  roles: string[];
}

export class AuthError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// Resolve the JWT in the Authorization header to a fully-loaded caller context.
// Enforces CLAUDE.md hard rule: edge fns reject suspended (is_active=false)
// users even with a valid cached JWT.
export async function loadCaller(req: Request): Promise<CallerContext> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
    throw new AuthError(401, "missing or malformed Authorization header");
  }

  const userClient = getUserClient(authHeader);
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData.user) {
    throw new AuthError(401, "invalid token");
  }
  const authUserId = userData.user.id;

  const admin = getServiceRoleClient();
  const { data: appUser, error: appUserErr } = await admin
    .from("app_users")
    .select("id, email, full_name, is_active")
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  if (appUserErr) {
    throw new AuthError(500, `app_users lookup failed: ${appUserErr.message}`);
  }
  if (!appUser) throw new AuthError(401, "user not provisioned");
  if (!appUser.is_active) throw new AuthError(401, "account suspended");

  const { data: roles, error: rolesErr } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", appUser.id);
  if (rolesErr) {
    throw new AuthError(500, `roles lookup failed: ${rolesErr.message}`);
  }

  return {
    auth_user_id: authUserId,
    app_user_id: appUser.id,
    email: appUser.email,
    full_name: appUser.full_name,
    roles: (roles ?? []).map((r: { role: string }) => r.role),
  };
}

export function requireAnyRole(
  caller: CallerContext,
  allowed: readonly string[],
): void {
  if (!caller.roles.some((r) => allowed.includes(r))) {
    throw new AuthError(403, `requires role: ${allowed.join(" | ")}`);
  }
}

// Returns the strongest admin role the caller holds, used for audit_log.actor_role.
export function adminRoleFor(caller: CallerContext): string | null {
  if (caller.roles.includes("owner_admin")) return "owner_admin";
  if (caller.roles.includes("staff_admin")) return "staff_admin";
  return null;
}
