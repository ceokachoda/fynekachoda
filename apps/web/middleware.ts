import { type NextRequest, NextResponse } from "next/server";
import { createMiddlewareSupabase } from "@/lib/supabase/middleware";

// Public — anyone (signed-out included) can reach these.
const PUBLIC_PATH_PREFIXES: readonly string[] = [
  "/login",
  "/forgot-password",
  "/reset",
  "/suspended",
  "/privacy",
  "/terms",
  "/_styleguide", // dev-only, harmless in prod
] as const;

// Funnel paths a partially-authenticated user can land on.
const FUNNEL_PATH_PREFIXES: readonly string[] = [
  "/force-password-change",
  "/role-chooser",
  "/admin-redirect",
] as const;

const ACTIVE_ROLE_COOKIE = "fynestudy_active_role";

function startsWithAny(pathname: string, prefixes: readonly string[]): boolean {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function inGroup(pathname: string, group: "student" | "teacher"): boolean {
  // App Router route-groups don't appear in the URL — the surface paths the
  // (student) group renders are the student-only tabs: /, /classes, /library,
  // /attendance, /leaderboard, /profile, /menu. Teacher-only: /scan, /content,
  // /quizzes, /exams, /batch. /classes + /profile + /library overlap, so we
  // arbitrate via the active-role cookie when ambiguous.
  const studentOnly = ["/attendance", "/leaderboard", "/menu"];
  const teacherOnly = ["/scan", "/content", "/quizzes", "/exams", "/batch"];
  if (group === "student") return studentOnly.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  return teacherOnly.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const { supabase, response } = createMiddlewareSupabase(req);

  const isPublic = startsWithAny(pathname, PUBLIC_PATH_PREFIXES);
  // FUNNEL_PATH_PREFIXES is intentionally exported for tests + future branches.
  void FUNNEL_PATH_PREFIXES;

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) {
    if (isPublic) return response;
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Authed in Supabase. Resolve our `app_users` row + roles.
  const { data: appUser } = await supabase
    .from("app_users")
    .select("id, is_active, must_change_password")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!appUser) {
    // Authed but not provisioned in our schema — same trapdoor as mobile.
    if (pathname === "/admin-redirect") return response;
    const url = req.nextUrl.clone();
    url.pathname = "/admin-redirect";
    return NextResponse.redirect(url);
  }

  const { data: roleRows } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", appUser.id);
  const roles = (roleRows ?? []).map((r) => r.role);
  const isStudent = roles.includes("student");
  const isTeacher = roles.includes("teacher");
  const isAdmin =
    roles.includes("owner_admin") || roles.includes("staff_admin");

  if (!appUser.is_active) {
    if (pathname === "/suspended") return response;
    const url = req.nextUrl.clone();
    url.pathname = "/suspended";
    return NextResponse.redirect(url);
  }

  if (isAdmin && !isStudent && !isTeacher) {
    if (pathname === "/admin-redirect") return response;
    const url = req.nextUrl.clone();
    url.pathname = "/admin-redirect";
    return NextResponse.redirect(url);
  }

  if (appUser.must_change_password) {
    if (pathname === "/force-password-change") return response;
    const url = req.nextUrl.clone();
    url.pathname = "/force-password-change";
    return NextResponse.redirect(url);
  }

  // Multi-role: cookie wins; otherwise route to chooser.
  const cookieRole = req.cookies.get(ACTIVE_ROLE_COOKIE)?.value;
  if (isStudent && isTeacher) {
    if (cookieRole !== "student" && cookieRole !== "teacher") {
      if (pathname === "/role-chooser") return response;
      const url = req.nextUrl.clone();
      url.pathname = "/role-chooser";
      return NextResponse.redirect(url);
    }
  }

  // Determined active role for downstream group gating.
  const activeRole: "student" | "teacher" | null =
    isStudent && isTeacher
      ? cookieRole === "teacher"
        ? "teacher"
        : "student"
      : isStudent
        ? "student"
        : isTeacher
          ? "teacher"
          : null;

  // Block cross-role tab paths that don't belong to the active role.
  if (inGroup(pathname, "student") && activeRole !== "student") {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }
  if (inGroup(pathname, "teacher") && activeRole !== "teacher") {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  // Fully resolved. Bounce a logged-in user away from public/funnel screens.
  if (
    pathname === "/login" ||
    pathname === "/forgot-password" ||
    pathname === "/reset" ||
    pathname === "/suspended" ||
    pathname === "/admin-redirect" ||
    pathname === "/force-password-change" ||
    (pathname === "/role-chooser" && !(isStudent && isTeacher))
  ) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Skip Next internals + static files (anything with a dot in the segment).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons/|sw.js|manifest.webmanifest|.*\\..*).*)"],
};
