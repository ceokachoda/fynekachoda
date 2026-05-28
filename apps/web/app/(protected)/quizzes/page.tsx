import { requireTeacher } from "@/lib/auth";
import { TeacherQuizzesClient } from "./_components/TeacherQuizzesClient";

export const metadata = { title: "Quizzes" };

export default async function QuizzesPage() {
  await requireTeacher();
  return <TeacherQuizzesClient />;
}
