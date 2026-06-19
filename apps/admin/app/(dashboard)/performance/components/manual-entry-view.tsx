"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { getBatchDetails, bulkUpsertOfflineScoresAction } from "../actions";
import { BatchOpt } from "../page";

interface Props {
  batches: BatchOpt[];
  onComplete: () => void;
}

export function ManualEntryView({ batches, onComplete }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [batchId, setBatchId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [testName, setTestName] = useState("");
  const [testDate, setTestDate] = useState(new Date().toISOString().slice(0, 10));
  const [maxScore, setMaxScore] = useState<number | "">("");

  const [students, setStudents] = useState<{ user_id: string; full_name: string }[]>([]);
  const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Score state
  const [scores, setScores] = useState<Record<string, { score: number | ""; notes: string }>>({});

  const loadBatch = async (bId: string) => {
    setBatchId(bId);
    setSubjectId("");
    setStudents([]);
    setSubjects([]);
    if (!bId) return;
    setLoadingDetails(true);
    try {
      const data = await getBatchDetails(bId);
      setStudents(data.students);
      setSubjects(data.subjects);
      const initialScores: Record<string, { score: ""; notes: "" }> = {};
      data.students.forEach((s) => {
        initialScores[s.user_id] = { score: "", notes: "" };
      });
      setScores(initialScores);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleScoreChange = (userId: string, val: string) => {
    setScores((prev) => ({
      ...prev,
      [userId]: { notes: "", ...(prev[userId] || {}), score: val === "" ? "" : Number(val) },
    }));
  };

  const submit = () => {
    setError(null);
    if (!batchId || !testName || !testDate || maxScore === "") {
      setError("Please fill out all required fields.");
      return;
    }
    
    const entries: { student_id: string; score: number; notes: string | null }[] = [];
    for (const [userId, data] of Object.entries(scores)) {
      if (data.score !== "") {
        if (data.score < 0 || data.score > maxScore) {
          setError(`Score for a student is out of bounds (0 - ${maxScore}).`);
          return;
        }
        entries.push({
          student_id: userId,
          score: data.score,
          notes: data.notes || null,
        });
      }
    }

    if (entries.length === 0) {
      setError("No scores entered.");
      return;
    }

    startTransition(async () => {
      const res = await bulkUpsertOfflineScoresAction({}, {
        batch_id: batchId,
        test_name: testName,
        test_date: testDate,
        subject_id: subjectId || null,
        max_score: maxScore as number,
        entries,
      });

      if (res.error) {
        setError(res.error);
      } else {
        onComplete(); // go back to list
      }
    });
  };

  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm p-6 space-y-6">
      <div className="sticky top-0 z-20 bg-card py-4 px-6 -mx-6 -mt-6 mb-6 rounded-t-2xl border-b border-border shadow-sm">
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
              placeholder="e.g. [Unit Test] Math Chapter 1"
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
      </div>

      {error && (
        <div className="rounded-md border border-destructive bg-destructive/15 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {loadingDetails ? (
        <div className="h-32 flex items-center justify-center text-sm text-muted-foreground">Loading students...</div>
      ) : students.length > 0 ? (
        <div className="border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted border-b border-border text-left text-[11px] uppercase text-muted-foreground tracking-wide">
              <tr>
                <th className="px-4 py-2 w-12 text-center">#</th>
                <th className="px-4 py-2">Student Name</th>
                <th className="px-4 py-2 w-32 text-right">Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {students.map((student, idx) => {
                const scoreVal = scores[student.user_id]?.score ?? "";
                const isInvalid = scoreVal !== "" && maxScore !== "" && Number(scoreVal) > Number(maxScore);

                return (
                  <tr key={student.user_id} className="hover:bg-muted/30">
                    <td className="px-4 py-2 text-center text-muted-foreground text-xs">{idx + 1}</td>
                    <td className="px-4 py-2 font-medium">{student.full_name}</td>
                    <td className="px-4 py-2 text-right">
                      <input
                        type="number"
                        step="0.1"
                        min={0}
                        max={maxScore || 100}
                        value={scoreVal}
                        data-score-idx={idx}
                        onChange={(e) => handleScoreChange(student.user_id, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === "ArrowDown") {
                            e.preventDefault();
                            const next = document.querySelector(`input[data-score-idx="${idx + 1}"]`) as HTMLInputElement;
                            if (next) {
                              next.focus();
                              next.select();
                            }
                          } else if (e.key === "ArrowUp") {
                            e.preventDefault();
                            const prev = document.querySelector(`input[data-score-idx="${idx - 1}"]`) as HTMLInputElement;
                            if (prev) {
                              prev.focus();
                              prev.select();
                            }
                          }
                        }}
                        className={`w-20 h-8 rounded-md border bg-background px-2 text-sm text-right focus-visible:ring-1 focus-visible:ring-primary outline-none transition-colors ${
                          isInvalid ? "border-destructive text-destructive focus-visible:ring-destructive" : "border-input"
                        }`}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : batchId && !loadingDetails ? (
        <div className="h-32 flex items-center justify-center text-sm text-muted-foreground">No active students in this batch.</div>
      ) : null}

      <div className="flex justify-end gap-3 pt-4 border-t border-border">
        <Button variant="outline" onClick={onComplete} disabled={pending}>Cancel</Button>
        <Button onClick={submit} disabled={pending || !batchId || !testName || !testDate || maxScore === ""}>
          {pending ? "Saving..." : "Save Scores"}
        </Button>
      </div>
    </div>
  );
}
