import { redirect } from "next/navigation";
import { loadWebSession } from "@/lib/auth";
import { RosterClient } from "./_components/RosterClient";

export const metadata = { title: "Roster" };
export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ sessionId: string }>;
}

export default async function RosterPage({ params }: Props) {
  const { session, redirectTo } = await loadWebSession();
  if (redirectTo) redirect(redirectTo);
  if (!session || session.active_role !== "teacher") redirect("/");
  const { sessionId } = await params;
  return <RosterClient sessionId={sessionId} />;
}
