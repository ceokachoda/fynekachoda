"use client";

import { useState, useTransition } from "react";
import { getBatchReportData } from "../actions";
import { ReportCardTemplate, type ReportCardData } from "./report-card-template";
import { Button } from "@/components/ui/button";
import { Printer, Loader2, FileText, CheckCircle2 } from "lucide-react";
import type { BatchOpt } from "../page";

interface Props {
  batches: BatchOpt[];
}

export function ReportCardView({ batches }: Props) {
  const [selectedBatch, setSelectedBatch] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<string>("all");
  
  const [loading, startTransition] = useTransition();
  const [reportData, setReportData] = useState<ReportCardData[]>([]);
  const [batchStudents, setBatchStudents] = useState<{id: string; name: string}[]>([]);

  const handleGenerate = () => {
    if (!selectedBatch) return;
    
    startTransition(async () => {
      try {
        const data = await getBatchReportData(selectedBatch);
        setBatchStudents(data.students);
        
        // Transform to ReportCardData array
        const cards: ReportCardData[] = data.students.map(student => {
          const studentScores = data.scores.filter(s => s.student_id === student.id);
          const studentAtt = data.attendance.filter(a => a.student_id === student.id);
          return {
            student: { id: student.id, name: student.name },
            batch: { name: data.batchInfo.name, course: data.batchInfo.course },
            scores: studentScores,
            attendance: studentAtt
          };
        });
        
        setReportData(cards);
      } catch (err) {
        console.error(err);
      }
    });
  };

  const handlePrint = () => {
    window.print();
  };

  // Filter for display based on selection
  const cardsToRender = reportData.filter(c => selectedStudent === "all" || c.student.id === selectedStudent);

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-2xl border border-border p-6 shadow-sm print:hidden">
        <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" />
          Report Card Generator
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
          <div className="space-y-2">
            <label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Select Batch</label>
            <select
              value={selectedBatch}
              onChange={(e) => {
                setSelectedBatch(e.target.value);
                setReportData([]);
                setBatchStudents([]);
                setSelectedStudent("all");
              }}
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus:ring-2 focus:ring-primary focus:outline-none"
            >
              <option value="">-- Choose a Batch --</option>
              {batches.map(b => (
                <option key={b.id} value={b.id}>{b.name} ({b.course_id})</option>
              ))}
            </select>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Select Student</label>
            <select
              value={selectedStudent}
              onChange={(e) => setSelectedStudent(e.target.value)}
              disabled={reportData.length === 0}
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus:ring-2 focus:ring-primary focus:outline-none disabled:opacity-50"
            >
              <option value="all">Entire Batch (Bulk Print)</option>
              {batchStudents.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          
          <div className="flex gap-3">
            <Button onClick={handleGenerate} disabled={!selectedBatch || loading} className="flex-1">
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
              {reportData.length > 0 ? "Refresh Data" : "Generate"}
            </Button>
            
            {reportData.length > 0 && (
              <Button onClick={handlePrint} variant="outline" className="border-primary text-primary hover:bg-primary/10">
                <Printer className="w-4 h-4 mr-2" />
                Print / Save PDF
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Preview Area */}
      {cardsToRender.length > 0 && (
        <div className="mt-8">
          <div className="flex justify-between items-center mb-4 print:hidden">
            <h3 className="text-lg font-semibold text-muted-foreground">Preview: {cardsToRender.length} Report Card(s)</h3>
            <p className="text-xs text-muted-foreground">Pages will automatically break when printed.</p>
          </div>
          
          {/* 
            Print styling: 
            In print mode, we want this container to be absolute/fixed over everything else to hide the sidebar,
            or we rely on FyneStudy's global print styles.
            We add classes to make it behave nicely on screen and paper.
          */}
          <div className="space-y-12 print:space-y-0 print:block print:absolute print:left-0 print:top-0 print:w-full print:bg-white print:z-[99999]">
            {cardsToRender.map((card, i) => (
              <ReportCardTemplate key={`${card.student.id}-${i}`} data={card} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
