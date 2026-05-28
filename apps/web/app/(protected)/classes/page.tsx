import { redirect } from "next/navigation";
import { loadWebSession } from "@/lib/auth";
import { PageHeader } from "@/components/fyne/PageHeader";
import { EmptyState } from "@/components/fyne/EmptyState";
import { StudentClasses } from "./_components/StudentClasses";

export const metadata = { title: "Classes" };

export default async function ClassesPage() {
  const { session, redirectTo } = await loadWebSession();
  if (redirectTo) redirect(redirectTo);
  if (!session) redirect("/login");
  if (session.active_role !== "student") {
    return (
      <div className="space-y-6">
        <PageHeader title="Classes" />
        <EmptyState
          title="Teacher classes ship in Phase 4"
          description="The schedule-live tools and roster appear here when Phase 4 lands."
        />
      </div>
    );
  }
  return <StudentClasses />;
}
