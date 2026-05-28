import { redirect } from "next/navigation";
import { loadWebSession } from "@/lib/auth";
import { PageHeader } from "@/components/fyne/PageHeader";
import { EmptyState } from "@/components/fyne/EmptyState";
import { MenuClient } from "./_components/MenuClient";

export const metadata = { title: "Settings" };

export default async function MenuPage() {
  const { session, redirectTo } = await loadWebSession();
  if (redirectTo) redirect(redirectTo);
  if (!session) redirect("/login");
  if (session.active_role !== "student") {
    return (
      <div className="space-y-6">
        <PageHeader title="Settings" />
        <EmptyState
          title="Teacher settings ship in Phase 4"
          description="For now, sign out from the side rail."
        />
      </div>
    );
  }
  return <MenuClient />;
}
