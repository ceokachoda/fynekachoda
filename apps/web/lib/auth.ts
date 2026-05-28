import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type Role = "student" | "teacher" | "staff_admin" | "owner_admin";
export type ActiveRole = "student" | "teacher";

export const ACTIVE_ROLE_COOKIE = "fynestudy_active_role";

export interface WebSession {
  auth_user_id: string;
  app_user_id: string;
  email: string;
  full_name: string;
  roles: Role[];
  is_active: boolean;
  must_change_password: boolean;
  /** Resolved active role for multi-role users (cookie); otherwise the only role. */
  active_role: ActiveRole | null;
  access_token: string;
}

interface LoadProfileResult {
  session: WebSession | null;
  redirectTo: string | null;
}

// Loads the current user's profile + roles + active role cookie and resolves
// what they should be allowed to see. Returns either a usable WebSession or a
// redirect target the caller should follow (mirrors mobile's SplashRouter +
// admin middleware logic).
export async function loadWebSession(): Promise<LoadProfileResult> {
  const supabase = await createSupabaseServerClient();

  const {
    data: { session: supaSession },
    error: sessionErr,
  } = await supabase.auth.getSession();
  if (sessionErr || !supaSession) return { session: null, redirectTo: "/login" };

  const { data: appUser, error: appUserErr } = await supabase
    .from("app_users")
    .select("id, email, full_name, is_active, must_change_password")
    .eq("auth_user_id", supaSession.user.id)
    .maybeSingle();
  if (appUserErr || !appUser) {
    return { session: null, redirectTo: "/admin-redirect" };
  }

  const { data: roleRows, error: rolesErr } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", appUser.id);
  if (rolesErr) return { session: null, redirectTo: "/login" };

  const roles = ((roleRows ?? []).map((r) => r.role) as Role[]);
  const isStudent = roles.includes("student");
  const isTeacher = roles.includes("teacher");
  const isAdmin =
    roles.includes("owner_admin") || roles.includes("staff_admin");

  if (!appUser.is_active) {
    return {
      session: {
        auth_user_id: supaSession.user.id,
        app_user_id: appUser.id,
        email: appUser.email,
        full_name: appUser.full_name,
        roles,
        is_active: false,
        must_change_password: appUser.must_change_password,
        active_role: null,
        access_token: supaSession.access_token,
      },
      redirectTo: "/suspended",
    };
  }

  if (isAdmin && !isStudent && !isTeacher) {
    return {
      session: {
        auth_user_id: supaSession.user.id,
        app_user_id: appUser.id,
        email: appUser.email,
        full_name: appUser.full_name,
        roles,
        is_active: appUser.is_active,
        must_change_password: appUser.must_change_password,
        active_role: null,
        access_token: supaSession.access_token,
      },
      redirectTo: "/admin-redirect",
    };
  }

  if (appUser.must_change_password) {
    return {
      session: {
        auth_user_id: supaSession.user.id,
        app_user_id: appUser.id,
        email: appUser.email,
        full_name: appUser.full_name,
        roles,
        is_active: appUser.is_active,
        must_change_password: true,
        active_role: null,
        access_token: supaSession.access_token,
      },
      redirectTo: "/force-password-change",
    };
  }

  // Resolve active role: cookie wins for multi-role users; otherwise the only role.
  const cookieStore = await cookies();
  const cookieRole = cookieStore.get(ACTIVE_ROLE_COOKIE)?.value as
    | ActiveRole
    | undefined;
  let active: ActiveRole | null = null;
  if (isStudent && isTeacher) {
    if (cookieRole === "student" || cookieRole === "teacher") {
      active = cookieRole;
    } else {
      return {
        session: {
          auth_user_id: supaSession.user.id,
          app_user_id: appUser.id,
          email: appUser.email,
          full_name: appUser.full_name,
          roles,
          is_active: appUser.is_active,
          must_change_password: appUser.must_change_password,
          active_role: null,
          access_token: supaSession.access_token,
        },
        redirectTo: "/role-chooser",
      };
    }
  } else if (isStudent) {
    active = "student";
  } else if (isTeacher) {
    active = "teacher";
  }

  return {
    session: {
      auth_user_id: supaSession.user.id,
      app_user_id: appUser.id,
      email: appUser.email,
      full_name: appUser.full_name,
      roles,
      is_active: appUser.is_active,
      must_change_password: appUser.must_change_password,
      active_role: active,
      access_token: supaSession.access_token,
    },
    redirectTo: null,
  };
}

export async function requireUser(): Promise<WebSession> {
  const { session, redirectTo } = await loadWebSession();
  if (redirectTo) redirect(redirectTo);
  if (!session) redirect("/login");
  return session;
}

export async function requireStudent(): Promise<WebSession> {
  const session = await requireUser();
  if (session.active_role !== "student") redirect("/");
  return session;
}

export async function requireTeacher(): Promise<WebSession> {
  const session = await requireUser();
  if (session.active_role !== "teacher") redirect("/");
  return session;
}
