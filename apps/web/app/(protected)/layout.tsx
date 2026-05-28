import { redirect } from "next/navigation";
import { AppShell } from "@/components/fyne/AppShell";
import { SessionProvider } from "@/features/auth/SessionProvider";
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

  return (
    <QueryProvider>
      <SessionProvider>
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
