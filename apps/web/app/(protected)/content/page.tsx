import { BookOpen } from "lucide-react";
import { EmptyState } from "@/components/fyne/EmptyState";
import { PageHeader } from "@/components/fyne/PageHeader";
import { requireTeacher } from "@/lib/auth";

export const metadata = { title: "Library" };

export default async function ContentPage() {
  await requireTeacher();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Library"
        description="Upload + manage your study materials."
      />
      <EmptyState
        icon={BookOpen}
        title="Coming in Phase 4"
        description="Video URL or PDF presign+upload+finalize flow for your assigned topics."
      />
    </div>
  );
}
