import { redirect } from "next/navigation";
import { loadWebSession } from "@/lib/auth";
import { LiveClient } from "./_components/LiveClient";

export const metadata = { title: "Live class" };
export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ sessionId: string }>;
}

// Top-level live route OUTSIDE the (protected) group per W-23 / mobile D-169 —
// no side-rail or bottom-tabs during the class. Auth is enforced by
// middleware.ts; this server component only resolves the session for the
// initial render. The LiveClient wraps QueryProvider + SessionProvider itself
// (W-DEC-3.6 pattern).
export default async function LivePage({ params }: Props) {
  const { session, redirectTo } = await loadWebSession();
  if (redirectTo) redirect(redirectTo);
  if (!session) redirect("/login");
  if (!session.active_role) redirect("/admin-redirect");

  const { sessionId } = await params;
  return (
    <LiveClient
      sessionId={sessionId}
      fullName={session.full_name}
      activeRole={session.active_role}
    />
  );
}
