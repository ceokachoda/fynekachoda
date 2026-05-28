import { redirect } from "next/navigation";
import { loadWebSession } from "@/lib/auth";
import { StudentClasses } from "./_components/StudentClasses";
import { TeacherClasses } from "./_components/TeacherClasses";

export const metadata = { title: "Classes" };

export default async function ClassesPage() {
  const { session, redirectTo } = await loadWebSession();
  if (redirectTo) redirect(redirectTo);
  if (!session) redirect("/login");
  if (session.active_role === "teacher") return <TeacherClasses />;
  return <StudentClasses />;
}
