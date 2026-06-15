import { requireStudent } from "@/lib/auth";
import { StudentPracticeClient } from "./_components/StudentPracticeClient";

export const metadata = { title: "Quizzes" };

export default async function PracticePage() {
  await requireStudent();
  return <StudentPracticeClient />;
}
