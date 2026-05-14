import { type NextRequest, NextResponse } from "next/server";
import { createMiddlewareSupabase } from "./lib/supabase-middleware";

// Routes that do NOT require an authenticated admin session.
const PUBLIC_PATH_PREFIXES = [
  "/login",
  "/forgot-password",
  "/forbidden",
  "/api/health",
];

// Routes that an in-progress (not-yet-fully-authenticated) admin can land on
// during the login → 2fa → force-pw-change funnel.
const FUNNEL_PATH_PREFIXES = [
  "/2fa/enroll",
  "/2fa/verify",
  "/force-password-change",
];

function startsWithAny(pathname: string, prefixes: readonly string[]): boolean {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const { supabase, response } = createMiddlewareSupabase(req);

  const isPublic = startsWithAny(pathname, PUBLIC_PATH_PREFIXES);
  const isFunnel = startsWithAny(pathname, FUNNEL_PATH_PREFIXES);

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) {
    if (isPublic) return response;
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Authenticated. Load admin profile to decide where they're allowed to go.
  const { data: appUser } = await supabase
    .from("app_users")
    .select("id, must_change_password")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!appUser) {
    // Authed in Supabase but not provisioned in our schema — kick to login.
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  const { data: roleRows } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", appUser.id);
  const roles = (roleRows ?? []).map((r) => r.role);
  const isAdmin = roles.some((r) => r === "owner_admin" || r === "staff_admin");
  if (!isAdmin) {
    const url = req.nextUrl.clone();
    url.pathname = "/forbidden";
    return NextResponse.redirect(url);
  }

  const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const currentLevel = aalData?.currentLevel ?? "aal1";
  const nextLevel = aalData?.nextLevel ?? "aal1";

  // MFA state machine.
  const hasVerifiedFactor = nextLevel === "aal2";
  const mfaSatisfied = currentLevel === "aal2";

  // Stage A: no verified factor → must enroll.
  if (!hasVerifiedFactor) {
    if (pathname.startsWith("/2fa/enroll")) return response;
    const url = req.nextUrl.clone();
    url.pathname = "/2fa/enroll";
    return NextResponse.redirect(url);
  }

  // Stage B: verified factor exists, but this session hasn't satisfied it.
  if (!mfaSatisfied) {
    if (pathname.startsWith("/2fa/verify")) return response;
    const url = req.nextUrl.clone();
    url.pathname = "/2fa/verify";
    return NextResponse.redirect(url);
  }

  // Stage C: MFA satisfied, but password hasn't been changed yet.
  if (appUser.must_change_password) {
    if (pathname.startsWith("/force-password-change")) return response;
    const url = req.nextUrl.clone();
    url.pathname = "/force-password-change";
    return NextResponse.redirect(url);
  }

  // Stage D: fully authenticated. Block re-entry to login or the funnel.
  if (
    pathname === "/login" ||
    isFunnel ||
    pathname === "/forbidden"
  ) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Match every path except Next internals and static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
