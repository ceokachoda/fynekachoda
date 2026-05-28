import { QrCode } from "lucide-react";
import { EmptyState } from "@/components/fyne/EmptyState";
import { PageHeader } from "@/components/fyne/PageHeader";
import { requireTeacher } from "@/lib/auth";

export const metadata = { title: "Scan QR" };

export default async function ScanPage() {
  await requireTeacher();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Scan"
        description="Mark attendance by scanning the student's rotating QR."
      />
      <EmptyState
        icon={QrCode}
        title="Coming in Phase 4"
        description="Browser webcam QR scan via @yudiel/react-qr-scanner → attendance-qr-verify."
      />
    </div>
  );
}
