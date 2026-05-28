import { requireTeacher } from "@/lib/auth";
import { TeacherBatchListClient } from "./_components/TeacherBatchListClient";

export const metadata = { title: "Batches" };

export default async function BatchPage() {
  await requireTeacher();
  return <TeacherBatchListClient />;
}
