import { redirect } from "next/navigation";
import { loadWebSession } from "@/lib/auth";
import { ProfileClient } from "./_components/ProfileClient";
import { TeacherProfileClient } from "./_components/TeacherProfileClient";

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
      <TeacherProfileClient
        fullName={session.full_name}
        email={session.email}
      />
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
