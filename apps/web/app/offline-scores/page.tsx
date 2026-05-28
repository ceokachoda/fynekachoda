import { redirect } from "next/navigation";
import { loadWebSession } from "@/lib/auth";
import { OfflineScoresClient } from "./_components/OfflineScoresClient";

export const metadata = { title: "Offline scores" };
export const dynamic = "force-dynamic";

export default async function OfflineScoresPage() {
  const { session, redirectTo } = await loadWebSession();
  if (redirectTo) redirect(redirectTo);
  if (!session || session.active_role !== "teacher") redirect("/");
  return <OfflineScoresClient />;
}
