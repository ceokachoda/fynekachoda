import { redirect } from "next/navigation";
import { loadWebSession } from "@/lib/auth";
import { PageHeader } from "@/components/fyne/PageHeader";
import { EmptyState } from "@/components/fyne/EmptyState";
import { StudentDashboard } from "./_components/StudentDashboard";
import { greetingForIst } from "@/lib/ist";

export const metadata = { title: "Home" };

export default async function HomePage() {
  const { session, redirectTo } = await loadWebSession();
  if (redirectTo) redirect(redirectTo);
  if (!session || !session.active_role) redirect("/login");

  const greeting = greetingForIst();
  const firstName = session.full_name.split(/\s+/)[0] || "there";

  if (session.active_role === "student") {
    return (
      <StudentDashboard greeting={`${greeting}, ${firstName}`} />
    );
  }

  // Teacher dashboard is built in Phase 4. Keep a simple welcome until then.
  return (
    <div className="space-y-6" data-testid="teacher-home">
      <PageHeader title={`${greeting}, ${firstName}`} />
      <EmptyState
        title="Teacher dashboard coming in Phase 4"
        description="For now, use Classes and the other tabs from the side rail. The full teacher portal lands in the next phase."
      />
    </div>
  );
}
