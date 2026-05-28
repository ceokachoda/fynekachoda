import { requireTeacher } from "@/lib/auth";
import { TeacherExamsClient } from "./_components/TeacherExamsClient";

export const metadata = { title: "Exams" };

export default async function ExamsPage() {
  await requireTeacher();
  return <TeacherExamsClient />;
}
