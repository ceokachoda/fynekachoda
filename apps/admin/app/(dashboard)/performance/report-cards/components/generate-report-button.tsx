"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";
import { GenerateReportModal } from "./generate-report-modal";

export function GenerateReportButton({ batchId, studentId, variant = "default" }: { batchId: string; studentId?: string; variant?: "default" | "outline" }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button variant={variant} size="sm" onClick={() => setIsOpen(true)} className="gap-2">
        <FileText className="w-4 h-4" />
        {studentId ? "Generate Report Card" : "Generate Batch Reports"}
      </Button>

      <GenerateReportModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        batchId={batchId}
        studentId={studentId}
      />
    </>
  );
}
