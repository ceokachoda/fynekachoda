import { redirect } from "next/navigation";
import { AppShell } from "@/components/fyne/AppShell";
import { SessionProvider } from "@/features/auth/SessionProvider";
import { WebPushGate } from "@/features/notifications/WebPushGate";
import { QueryProvider } from "@/lib/query";
import { loadWebSession } from "@/lib/auth";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { session, redirectTo } = await loadWebSession();
  if (redirectTo) redirect(redirectTo);
  if (!session) redirect("/login");
  if (!session.active_role) redirect("/admin-redirect");

  const isMultiRole =
    session.roles.includes("student") && session.roles.includes("teacher");

  // Hydrate the client SessionProvider with the profile the server already
  // resolved. Without this the client re-fetches session → app_users →
  // user_roles over three sequential round-trips before any query that depends
  // on appUser.id (e.g. the student dashboard) can even start — which is why the
  // home screen showed only the greeting and felt sluggish. phone/dob are filled
  // in by the client's background refresh; nothing on first paint needs them.
  const initialSession = {
    appUser: {
      id: session.app_user_id,
      full_name: session.full_name,
      email: session.email,
      phone: null,
      dob: null,
      is_active: session.is_active,
      must_change_password: session.must_change_password,
    },
    roles: session.roles,
  };

  return (
    <QueryProvider>
      <SessionProvider initial={initialSession}>
        <WebPushGate />
        <AppShell
          fullName={session.full_name}
          email={session.email}
          activeRole={session.active_role}
          isMultiRole={isMultiRole}
        >
          {children}
        </AppShell>
      </SessionProvider>
    </QueryProvider>
  );
}
