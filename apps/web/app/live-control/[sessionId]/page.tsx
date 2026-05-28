import { redirect } from "next/navigation";
import { loadWebSession } from "@/lib/auth";
import { LiveControlClient } from "./_components/LiveControlClient";

export const metadata = { title: "Live control" };
export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ sessionId: string }>;
}

export default async function LiveControlPage({ params }: Props) {
  const { session, redirectTo } = await loadWebSession();
  if (redirectTo) redirect(redirectTo);
  if (!session || session.active_role !== "teacher") redirect("/");
  const { sessionId } = await params;
  return (
    <LiveControlClient
      sessionId={sessionId}
      fullName={session.full_name}
    />
  );
}
