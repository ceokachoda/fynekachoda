import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "./supabase-server";
import { env } from "./env";

export type AdminRole = "owner_admin" | "staff_admin";
export type AnyRole = AdminRole | "student" | "teacher";

export interface AdminSession {
  auth_user_id: string;
  app_user_id: string;
  email: string;
  full_name: string;
  roles: AnyRole[];
  isOwnerAdmin: boolean;
  must_change_password: boolean;
  access_token: string;
}

// Loads the current admin's profile. Redirects to /login if not signed in.
// Renders 403 (via redirect to /forbidden) if signed in but not an admin.
// Returns the typed session for use in admin server components and actions.
export async function requireAdmin(): Promise<AdminSession> {
  const supabase = await createSupabaseServerClient();

  const { data: { session }, error: sessionErr } = await supabase.auth.getSession();
  if (sessionErr || !session) redirect("/login");

  const { data: appUser, error: appUserErr } = await supabase
    .from("app_users")
    .select("id, email, full_name, must_change_password")
    .eq("auth_user_id", session.user.id)
    .maybeSingle();
  if (appUserErr || !appUser) redirect("/login");

  const { data: roleRows, error: rolesErr } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", appUser.id);
  if (rolesErr) redirect("/login");

  const roles = ((roleRows ?? []).map((r) => r.role) as AnyRole[]);
  const isOwnerAdmin = roles.includes("owner_admin");
  const isAdmin = isOwnerAdmin || roles.includes("staff_admin");
  if (!isAdmin) redirect("/forbidden");

  return {
    auth_user_id: session.user.id,
    app_user_id: appUser.id,
    email: appUser.email,
    full_name: appUser.full_name,
    roles,
    isOwnerAdmin,
    must_change_password: appUser.must_change_password,
    access_token: session.access_token,
  };
}

// Owner-only variant for admin/settings/courses-write paths.
export async function requireOwnerAdmin(): Promise<AdminSession> {
  const session = await requireAdmin();
  if (!session.isOwnerAdmin) redirect("/forbidden");
  return session;
}

// Invokes a Phase 2 auth edge function with the admin's session JWT.
// Returns the parsed response and the HTTP status so callers can branch on
// validation / 409 / 500 etc.
export async function callEdgeFn<TResp = unknown>(
  name: string,
  body: unknown,
  accessToken: string,
): Promise<{ status: number; data: TResp | { error: string; detail?: unknown } }> {
  const res = await fetch(`${env.supabaseUrl}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const text = await res.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    data = { error: text || `HTTP ${res.status}` };
  }
  return { status: res.status, data: data as TResp };
}
