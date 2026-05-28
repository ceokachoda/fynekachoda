import { redirect } from "next/navigation";
import { loadWebSession } from "@/lib/auth";
import { PageHeader } from "@/components/fyne/PageHeader";
import { EmptyState } from "@/components/fyne/EmptyState";
import { AttendanceClient } from "./_components/AttendanceClient";

export const metadata = { title: "Attendance" };

export default async function AttendancePage() {
  const { session, redirectTo } = await loadWebSession();
  if (redirectTo) redirect(redirectTo);
  if (!session) redirect("/login");
  if (session.active_role !== "student") {
    return (
      <div className="space-y-6">
        <PageHeader title="Attendance" />
        <EmptyState
          title="Teacher view ships in Phase 4"
          description="Teachers scan with the camera in /scan when Phase 4 ships."
        />
      </div>
    );
  }
  return <AttendanceClient />;
}
