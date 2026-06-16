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
  // /practice, /attendance, /leaderboard, /profile. Teacher-only: /scan,
  // /content, /quizzes, /exams, /batch. /classes + /profile + /library overlap,
  // so we arbitrate via the active-role cookie when ambiguous.
  //
  // Phase 4 Track 4B adds 6 top-level teacher-only routes OUTSIDE
  // `(protected)` (FocusLayout, no side-rail). /live/{id} + /recording/{id}
  // stay open to BOTH roles (Track 4A — student joins live + watches
  // recordings; teacher uses /live-control for the broadcast operator view).
  const studentOnly = ["/practice", "/attendance", "/leaderboard"];
  const teacherOnly = [
    "/scan",
    "/content",
    "/quizzes",
    "/exams",
    "/batch",
    "/quiz-builder",
    "/exam-builder",
    "/exam-results",
    "/offline-scores",
    "/roster",
    "/live-control",
  ];
  if (group === "student") return studentOnly.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  return teacherOnly.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const { supabase, response } = createMiddlewareSupabase(req);

  // Build a redirect that PRESERVES any refreshed-session cookies Supabase
  // attached to `response` during getUser(). A bare NextResponse.redirect is a
  // fresh response and would drop those Set-Cookie headers — losing a token
  // refresh that lands on a redirecting request and causing intermittent
  // "logged out / redirect loop" symptoms (@supabase/ssr footgun).
  const redirectTo = (configure: (url: URL) => void): NextResponse => {
    const url = req.nextUrl.clone();
    url.search = "";
    configure(url);
    const redirect = NextResponse.redirect(url);
    for (const cookie of response.cookies.getAll()) {
      redirect.cookies.set(cookie);
    }
    return redirect;
  };

  const isPublic = startsWithAny(pathname, PUBLIC_PATH_PREFIXES);
  // FUNNEL_PATH_PREFIXES is intentionally exported for tests + future branches.
  void FUNNEL_PATH_PREFIXES;

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) {
    if (isPublic) return response;
    // Distinguish "definitely signed out" from "couldn't verify right now". A
    // transient auth hiccup — or a token refresh that lost a rotation race on a
    // hard page refresh — must NOT log a valid user out. If the request still
    // carries a Supabase auth cookie and getUser *errored* (rather than cleanly
    // reporting no session), let it through: the protected layout's own
    // server-side session check is the authority and will redirect if the
    // session is genuinely gone, while RLS + each edge function's own getUser
    // remain the real security boundary regardless. Only bounce to /login when
    // there's no auth cookie at all (a genuine signed-out / first visit).
    const hasAuthCookie = req.cookies
      .getAll()
      .some((c) => c.name.includes("auth-token"));
    if (userErr && hasAuthCookie) return response;
    return redirectTo((url) => {
      url.pathname = "/login";
      if (pathname !== "/") url.searchParams.set("next", pathname);
    });
  }

  // Authed in Supabase. Resolve our `app_users` row + roles.
  const { data: appUser, error: appUserErr } = await supabase
    .from("app_users")
    .select("id, is_active, must_change_password")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  // A transient read failure for a user we just confirmed is authenticated must
  // not bounce them to the not-provisioned trapdoor. Let the request through —
  // the protected layout re-resolves the profile authoritatively.
  if (appUserErr) return response;
  if (!appUser) {
    // Authed but not provisioned in our schema — same trapdoor as mobile.
    if (pathname === "/admin-redirect") return response;
    return redirectTo((url) => {
      url.pathname = "/admin-redirect";
    });
  }

  const { data: roleRows, error: rolesErr } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", appUser.id);
  // Same transient-tolerance: never make role-based routing decisions on a
  // failed read — that could strip a valid user of their role and misroute them.
  if (rolesErr) return response;
  const roles = (roleRows ?? []).map((r) => r.role);
  const isStudent = roles.includes("student");
  const isTeacher = roles.includes("teacher");
  const isAdmin =
    roles.includes("owner_admin") || roles.includes("staff_admin");

  if (!appUser.is_active) {
    if (pathname === "/suspended") return response;
    return redirectTo((url) => {
      url.pathname = "/suspended";
    });
  }

  if (isAdmin && !isStudent && !isTeacher) {
    if (pathname === "/admin-redirect") return response;
    return redirectTo((url) => {
      url.pathname = "/admin-redirect";
    });
  }

  if (appUser.must_change_password) {
    if (pathname === "/force-password-change") return response;
    return redirectTo((url) => {
      url.pathname = "/force-password-change";
    });
  }

  // Multi-role: cookie wins; otherwise route to chooser.
  const cookieRole = req.cookies.get(ACTIVE_ROLE_COOKIE)?.value;
  if (isStudent && isTeacher) {
    if (cookieRole !== "student" && cookieRole !== "teacher") {
      if (pathname === "/role-chooser") return response;
      return redirectTo((url) => {
        url.pathname = "/role-chooser";
      });
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
    return redirectTo((url) => {
      url.pathname = "/";
    });
  }
  if (inGroup(pathname, "teacher") && activeRole !== "teacher") {
    return redirectTo((url) => {
      url.pathname = "/";
    });
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
    return redirectTo((url) => {
      url.pathname = "/";
    });
  }

  return response;
}

export const config = {
  // Skip Next internals + static files (anything with a dot in the segment).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons/|sw.js|manifest.webmanifest|.*\\..*).*)"],
};
