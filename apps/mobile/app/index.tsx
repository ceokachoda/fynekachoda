import { useEffect, useRef, useState } from "react";
import { useRouter } from "expo-router";
import { useSession } from "@/features/auth/useSession";
import { useRole } from "@/features/auth/useRole";
import { signOut } from "@/features/auth/auth";
import { LoadingScreen } from "@/components/LoadingScreen";

// Splash / router. Reads the session and routes to:
//   - /login                 — when not signed in
//   - /account-issue         — signed in but the profile never loaded (a flaky
//                              connection or a broken account); offers Retry +
//                              Sign out. NEVER the old "Admin account" card.
//   - /suspended             — when signed in but app_users.is_active is false
//   - /force-password-change — when must_change_password is true
//   - /(student)             — student role
//   - /(teacher)             — teacher role
//   - /role-chooser          — when both student + teacher (multi-role)
//   - login (after sign-out)  — admin-only accounts: the mobile app is for
//                              students & teachers; admins use the web panel, so
//                              we sign them out and return to login.

const LOAD_TIMEOUT_MS = 10_000;

export default function SplashRouter() {
  const router = useRouter();
  const { isLoading, session, appUser } = useSession();
  const role = useRole();
  const [timedOut, setTimedOut] = useState(false);
  const signingOut = useRef(false);

  // "Resolving" = we don't yet know the final auth destination. This includes
  // the post-sign-in window where the session is already set but SessionProvider
  // is still fetching app_users/roles (appUser briefly null). During that window
  // we MUST wait, never redirect — bouncing to /login here ping-pongs against
  // login.tsx's own "session → /" redirect and loops the navigator
  // ("Maximum update depth exceeded" on re-login).
  const resolving = isLoading || (!!session && !appUser);

  useEffect(() => {
    if (!resolving) {
      setTimedOut(false);
      return;
    }
    const t = setTimeout(() => setTimedOut(true), LOAD_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [resolving]);

  useEffect(() => {
    if (resolving && !timedOut) return;

    if (!session) {
      router.replace("/login");
      return;
    }
    if (!appUser) {
      // Signed in but no profile row resolved (even after the timeout): almost
      // always a weak connection, occasionally a broken account. Send to the
      // neutral retry screen — never the admin card, which made a student on a
      // flaky network think something was deeply wrong.
      router.replace("/account-issue");
      return;
    }
    if (!appUser.is_active) {
      router.replace("/suspended");
      return;
    }
    if (appUser.must_change_password) {
      router.replace("/force-password-change");
      return;
    }
    if (role.isMultiRole) {
      router.replace("/role-chooser");
      return;
    }
    if (role.isStudent) {
      router.replace("/(student)");
      return;
    }
    if (role.isTeacher) {
      router.replace("/(teacher)");
      return;
    }

    // Admin-only (or any account with no student/teacher role): the mobile app
    // is for students & teachers only. Sign out and return to login so the
    // confusing "Admin account" card never appears. Guarded so the effect only
    // triggers sign-out once; the resulting session change re-runs this and
    // lands on /login via the !session branch above.
    if (!signingOut.current) {
      signingOut.current = true;
      void signOut().finally(() => router.replace("/login"));
    }
  }, [resolving, timedOut, session, appUser, role, router]);

  return <LoadingScreen />;
}
