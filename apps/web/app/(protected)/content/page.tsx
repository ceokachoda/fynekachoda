import { requireTeacher } from "@/lib/auth";
import { TeacherUploadClient } from "./_components/TeacherUploadClient";

export const metadata = { title: "Upload content" };

export default async function ContentPage() {
  await requireTeacher();
  return <TeacherUploadClient />;
}
