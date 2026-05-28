import { ListChecks } from "lucide-react";
import { EmptyState } from "@/components/fyne/EmptyState";
import { PageHeader } from "@/components/fyne/PageHeader";
import { requireTeacher } from "@/lib/auth";

export const metadata = { title: "Quizzes" };

export default async function QuizzesPage() {
  await requireTeacher();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Quizzes"
        description="Author practice quizzes for your topics."
      />
      <EmptyState
        icon={ListChecks}
        title="Coming in Phase 3"
        description="Quiz builder with cascading topic picker + inline question editor + Add from bank."
      />
    </div>
  );
}
