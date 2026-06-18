"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getAvailableTestsForBatch } from "../actions";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  batchId: string;
  studentId?: string; // If provided, generates for this student only
}

export function GenerateReportModal({ isOpen, onClose, batchId, studentId }: Props) {
  const [tests, setTests] = useState<{ name: string; date: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTest, setSelectedTest] = useState("");

  useEffect(() => {
    if (isOpen && batchId) {
      setLoading(true);
      getAvailableTestsForBatch(batchId).then((res) => {
        setTests(res);
        const first = res[0];
        if (first) setSelectedTest(first.name);
        setLoading(false);
      });
    }
  }, [isOpen, batchId]);

  const handleGenerate = () => {
    if (!selectedTest) return;
    const url = new URL("/print/report-card", window.location.origin);
    url.searchParams.set("batch_id", batchId);
    url.searchParams.set("test_name", selectedTest);
    if (studentId) {
      url.searchParams.set("student_id", studentId);
    }
    
    window.open(url.toString(), "_blank");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Generate Report Card{studentId ? "" : "s"}</DialogTitle>
          <DialogDescription>
            Select the examination to generate the official {studentId ? "student" : "batch"} report card. 
            The report will open in a new tab formatted for printing or PDF export.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading available assessments...</div>
          ) : tests.length === 0 ? (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
              No exam scores have been recorded for this batch yet.
            </div>
          ) : (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Select Assessment</label>
              <select
                value={selectedTest}
                onChange={(e) => setSelectedTest(e.target.value)}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus-visible:ring-1 focus-visible:ring-ring"
              >
                {tests.map(t => (
                  <option key={t.name} value={t.name}>{t.name} (Recorded: {t.date})</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleGenerate} disabled={loading || tests.length === 0 || !selectedTest}>
            Generate & Preview
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
