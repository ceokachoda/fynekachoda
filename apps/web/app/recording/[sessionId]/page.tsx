import { redirect } from "next/navigation";
import { loadWebSession } from "@/lib/auth";
import { RecordingClient } from "./_components/RecordingClient";

export const metadata = { title: "Recording" };
export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ sessionId: string }>;
}

// Top-level recording route OUTSIDE the (protected) group per W-23 / mobile
// D-169 — focused viewing. Auth is enforced by middleware.ts.
export default async function RecordingPage({ params }: Props) {
  const { session, redirectTo } = await loadWebSession();
  if (redirectTo) redirect(redirectTo);
  if (!session) redirect("/login");
  if (!session.active_role) redirect("/admin-redirect");

  const { sessionId } = await params;
  return (
    <RecordingClient sessionId={sessionId} fullName={session.full_name} />
  );
}
