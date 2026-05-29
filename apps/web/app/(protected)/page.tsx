import { redirect } from "next/navigation";
import { loadWebSession } from "@/lib/auth";
import { StudentDashboard } from "./_components/StudentDashboard";
import { TeacherDashboard } from "./_components/TeacherDashboard";
import { greetingForIst, formatIstWeekdayDate } from "@/lib/ist";

export const metadata = { title: "Home" };

export default async function HomePage() {
  const { session, redirectTo } = await loadWebSession();
  if (redirectTo) redirect(redirectTo);
  if (!session || !session.active_role) redirect("/login");

  const greeting = greetingForIst();
  const firstName = session.full_name.split(/\s+/)[0] || "there";

  if (session.active_role === "student") {
    return (
      <StudentDashboard
        greeting={`${greeting}, ${firstName}`}
        dateLabel={formatIstWeekdayDate()}
      />
    );
  }
  return <TeacherDashboard greeting={`${greeting}, ${firstName}`} />;
}
