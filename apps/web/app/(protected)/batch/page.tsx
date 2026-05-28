import { Users } from "lucide-react";
import { EmptyState } from "@/components/fyne/EmptyState";
import { PageHeader } from "@/components/fyne/PageHeader";
import { requireTeacher } from "@/lib/auth";

export const metadata = { title: "Batch" };

export default async function BatchPage() {
  await requireTeacher();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Batch"
        description="Your assigned batches and student rosters."
      />
      <EmptyState
        icon={Users}
        title="Coming in Phase 2"
        description="Batch list + per-batch overview (attendance heatmap, topic mastery bars, at-risk students)."
      />
    </div>
  );
}
