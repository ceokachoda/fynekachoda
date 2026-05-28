import { redirect } from "next/navigation";
import { loadWebSession } from "@/lib/auth";
import { PageHeader } from "@/components/fyne/PageHeader";
import { EmptyState } from "@/components/fyne/EmptyState";
import { ProfileClient } from "./_components/ProfileClient";

export const metadata = { title: "Profile" };

interface Props {
  searchParams: Promise<{ tab?: string }>;
}

export default async function ProfilePage({ searchParams }: Props) {
  const { session, redirectTo } = await loadWebSession();
  if (redirectTo) redirect(redirectTo);
  if (!session) redirect("/login");

  if (session.active_role !== "student") {
    return (
      <div className="space-y-6">
        <PageHeader title="Profile" />
        <EmptyState
          title="Teacher profile coming in Phase 4"
          description="The full teacher portal lands in the next phase."
        />
      </div>
    );
  }

  const sp = await searchParams;
  const initialTab =
    sp.tab === "mastery" || sp.tab === "badges" ? sp.tab : "profile";

  return (
    <ProfileClient
      fullName={session.full_name}
      email={session.email}
      initialTab={initialTab}
    />
  );
}
