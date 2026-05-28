import { redirect } from "next/navigation";
import { loadWebSession } from "@/lib/auth";
import { PageHeader } from "@/components/fyne/PageHeader";
import { EmptyState } from "@/components/fyne/EmptyState";
import { LeaderboardClient } from "./_components/LeaderboardClient";

export const metadata = { title: "Leaderboard" };

export default async function LeaderboardPage() {
  const { session, redirectTo } = await loadWebSession();
  if (redirectTo) redirect(redirectTo);
  if (!session) redirect("/login");
  if (session.active_role !== "student") {
    return (
      <div className="space-y-6">
        <PageHeader title="Leaderboard" />
        <EmptyState
          title="Teacher view ships in Phase 4"
          description="Student rankings will appear here when you switch to your student tab."
        />
      </div>
    );
  }
  return <LeaderboardClient />;
}
