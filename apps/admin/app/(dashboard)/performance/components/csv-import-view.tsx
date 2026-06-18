"use client";

import { useState, useTransition, useRef } from "react";
import { Button } from "@/components/ui/button";
import { getBatchDetails, bulkUpsertOfflineScoresAction } from "../actions";
import { BatchOpt } from "../page";
import { UploadCloud, AlertCircle, CheckCircle2 } from "lucide-react";

interface Props {
  batches: BatchOpt[];
  onComplete: () => void;
}

export function CsvImportView({ batches, onComplete }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [batchId, setBatchId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [testName, setTestName] = useState("");
  const [testDate, setTestDate] = useState(new Date().toISOString().slice(0, 10));
  const [maxScore, setMaxScore] = useState<number | "">("");

  const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([]);
  const [students, setStudents] = useState<{ user_id: string; full_name: string; email: string }[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [, setFile] = useState<File | null>(null);

  const [parsedEntries, setParsedEntries] = useState<{ student_id: string; email: string; score: number; notes: string | null }[] | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const loadBatch = async (bId: string) => {
    setBatchId(bId);
    setSubjectId("");
    setStudents([]);
    setSubjects([]);
    setParsedEntries(null);
    setFile(null);
    if (!bId) return;
    try {
      const data = await getBatchDetails(bId);
      setStudents(data.students);
      setSubjects(data.subjects);
    } catch (e: unknown) {
      setError((e as Error).message);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      parseCsv(e.target.files[0]);
    }
  };

  const downloadTemplate = () => {
    const header = "Student Email,Score,Notes\n";
    const body = students.map((s) => `${s.email},,`).join("\n");
    const blob = new Blob([header + body], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `template-batch-${batchId}.csv`;
    a.click();
  };

  const parseCsv = (f: File) => {
    setValidationErrors([]);
    setParsedEntries(null);

    if (!maxScore) {
      setValidationErrors(["Please set a Max Score first."]);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split(/\r?\n/).filter(line => line.trim() !== "");
      if (lines.length <= 1) {
        setValidationErrors(["CSV file is empty or only contains headers."]);
        return;
      }

      const firstLine = lines[0];
      if (!firstLine) return;
      const headers = firstLine.split(",").map(h => h.trim().toLowerCase());
      const emailIdx = headers.findIndex(h => h === "student email" || h === "email");
      const scoreIdx = headers.findIndex(h => h === "score");
      const notesIdx = headers.findIndex(h => h === "notes");

      if (emailIdx === -1 || scoreIdx === -1) {
        setValidationErrors(["CSV must contain 'Student Email' and 'Score' columns."]);
        return;
      }

      const entries: typeof parsedEntries = [];
      const errors: string[] = [];
      const seenEmails = new Set<string>();

      for (let i = 1; i < lines.length; i++) {
        // Very basic CSV parsing (doesn't handle quotes perfectly, but sufficient for this specific use case)
        const line = lines[i];
        if (!line) continue;
        const cols = line.split(",");
        const email = cols[emailIdx]?.trim();
        const scoreStr = cols[scoreIdx]?.trim();
        const notes = notesIdx !== -1 ? cols[notesIdx]?.trim() : null;

        if (!email && !scoreStr) continue; // Skip truly empty rows

        if (!email) {
          errors.push(`Row ${i + 1}: Missing email.`);
          continue;
        }

        if (seenEmails.has(email)) {
          errors.push(`Row ${i + 1}: Duplicate email found (${email}).`);
          continue;
        }
        seenEmails.add(email);

        const student = students.find(s => s.email.toLowerCase() === email.toLowerCase());
        if (!student) {
          errors.push(`Row ${i + 1}: Student with email ${email} not found in this batch.`);
          continue;
        }

        if (!scoreStr) {
          // It's okay if score is empty, we just skip it (meaning we won't enter a score for them)
          continue;
        }

        const score = parseFloat(scoreStr);
        if (isNaN(score)) {
          errors.push(`Row ${i + 1}: Invalid score format for ${email}.`);
          continue;
        }

        if (score < 0 || score > (maxScore as number)) {
          errors.push(`Row ${i + 1}: Score ${score} out of bounds for ${email}.`);
          continue;
        }

        entries.push({
          student_id: student.user_id,
          email,
          score,
          notes: notes || null
        });
      }

      if (errors.length > 0) {
        setValidationErrors(errors);
      } else {
        setParsedEntries(entries);
      }
    };
    reader.readAsText(f);
  };

  const submit = () => {
    setError(null);
    if (!batchId || !testName || !testDate || !maxScore || !parsedEntries) {
      setError("Please ensure all fields are filled and a valid CSV is uploaded.");
      return;
    }

    startTransition(async () => {
      const res = await bulkUpsertOfflineScoresAction({}, {
        batch_id: batchId,
        test_name: testName,
        test_date: testDate,
        subject_id: subjectId || null,
        max_score: maxScore as number,
        entries: parsedEntries.map(e => ({ student_id: e.student_id, score: e.score, notes: e.notes })),
      });

      if (res.error) {
        setError(res.error);
      } else {
        onComplete();
      }
    });
  };

  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm p-6 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Batch *</label>
          <select
            value={batchId}
            onChange={(e) => loadBatch(e.target.value)}
            className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="">Select Batch</option>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Subject</label>
          <select
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            disabled={!batchId}
            className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
          >
            <option value="">All / General</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Test Name *</label>
          <input
            type="text"
            placeholder="e.g. [Unit Test] Math"
            value={testName}
            onChange={(e) => setTestName(e.target.value)}
            className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Test Date *</label>
          <input
            type="date"
            value={testDate}
            onChange={(e) => setTestDate(e.target.value)}
            className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Max Score *</label>
          <input
            type="number"
            min={1}
            placeholder="100"
            value={maxScore}
            onChange={(e) => setMaxScore(e.target.value === "" ? "" : Number(e.target.value))}
            className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-destructive bg-destructive/15 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {batchId && maxScore ? (
        <div className="border border-dashed border-border rounded-xl p-8 flex flex-col items-center justify-center text-center space-y-4">
          <div className="w-12 h-12 bg-primary/10 text-primary rounded-full flex items-center justify-center">
            <UploadCloud className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">Upload CSV Data</h3>
            <p className="text-sm text-muted-foreground max-w-sm mt-1">
              Ensure your CSV has &quot;Student Email&quot;, &quot;Score&quot;, and &quot;Notes&quot; columns.
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={downloadTemplate}>
              Download Template
            </Button>
            <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
              Choose File
            </Button>
            <input 
              type="file" 
              accept=".csv" 
              ref={fileInputRef} 
              className="hidden" 
              onChange={handleFileChange} 
            />
          </div>
        </div>
      ) : (
        <div className="border border-dashed border-border rounded-xl p-8 flex items-center justify-center text-sm text-muted-foreground">
          Select a batch and set the Max Score first to upload data.
        </div>
      )}

      {validationErrors.length > 0 && (
        <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-destructive font-medium">
            <AlertCircle className="w-4 h-4" />
            Validation Errors Found
          </div>
          <ul className="list-disc list-inside text-sm text-destructive/80 space-y-1">
            {validationErrors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {parsedEntries && validationErrors.length === 0 && (
        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4">
          <div className="flex items-center gap-2 text-emerald-600 font-medium">
            <CheckCircle2 className="w-4 h-4" />
            Ready to Import
          </div>
          <p className="text-sm text-emerald-600/80 mt-1">
            Successfully parsed {parsedEntries.length} valid score entries.
          </p>
        </div>
      )}

      <div className="flex justify-end gap-3 pt-4 border-t border-border">
        <Button variant="outline" onClick={onComplete} disabled={pending}>Cancel</Button>
        <Button onClick={submit} disabled={pending || !parsedEntries || validationErrors.length > 0}>
          {pending ? "Importing..." : "Run Import"}
        </Button>
      </div>
    </div>
  );
}
