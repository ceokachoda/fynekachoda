import { ClipboardCheck } from "lucide-react";
import { EmptyState } from "@/components/fyne/EmptyState";
import { PageHeader } from "@/components/fyne/PageHeader";
import { requireTeacher } from "@/lib/auth";

export const metadata = { title: "Exams" };

export default async function ExamsPage() {
  await requireTeacher();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Exams"
        description="Schedule and release graded exams."
      />
      <EmptyState
        icon={ClipboardCheck}
        title="Coming in Phase 3"
        description="Exam builder + server-timed attempts + manual/instant result release + regrade-with-audit."
      />
    </div>
  );
}
