"use client";

// Phase 4 Track 4B — offline test scores entry (FocusLayout). Mirrors mobile
// app/offline-scores.tsx. Existing scores pre-fill silently (locked decision
// #3); Save overwrites via offline-score-upsert (RLS-protected edge fn).

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Pill } from "@/components/fyne/Pill";
import { FocusLayout } from "@/components/fyne/FocusLayout";
import { QueryProvider } from "@/lib/query";
import { SessionProvider } from "@/features/auth/SessionProvider";
import { useTeacherBatches } from "@/features/teacher/useTeacherBatches";
import { useBatchSubjects } from "@/features/teacher/useBatchSubjects";
import { useOfflineScores } from "@/features/teacher/useOfflineScores";
import { useOfflineScoreUpsert } from "@/features/teacher/mutations";
import {
  validateScoreEntries,
} from "@/features/teacher/offline-score-validation";

function todayIstYmd(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

export function OfflineScoresClient() {
  return (
    <FocusLayout className="bg-slate-50">
      <QueryProvider>
        <SessionProvider>
          <OfflineInner />
        </SessionProvider>
      </QueryProvider>
    </FocusLayout>
  );
}

function OfflineInner() {
  const router = useRouter();
  const teacherBatches = useTeacherBatches();
  const [batchId, setBatchId] = useState<string | null>(null);
  const subjects = useBatchSubjects(batchId);
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [testName, setTestName] = useState("");
  const [testDate, setTestDate] = useState<string>(todayIstYmd());
  const [maxScore, setMaxScore] = useState("100");
  const ofs = useOfflineScores({
    batchId,
    testName: testName.trim() || null,
    testDate,
  });
  const upsert = useOfflineScoreUpsert();
  const [scores, setScores] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [info, setInfo] = useState<{ tone: "ok" | "err"; msg: string } | null>(
    null,
  );

  // Pre-fill existing scores silently (locked decision #3 — overwrite, no warning).
  useEffect(() => {
    const existing = ofs.data?.existing ?? [];
    if (existing.length === 0) return;
    setScores((prev) => {
      const next = { ...prev };
      for (const e of existing) next[e.student_id] = String(e.score);
      return next;
    });
    setNotes((prev) => {
      const next = { ...prev };
      for (const e of existing) {
        if (e.notes) next[e.student_id] = e.notes;
      }
      return next;
    });
  }, [ofs.data?.existing]);

  const maxScoreNum = Number.parseFloat(maxScore);
  const selectedBatch = useMemo(
    () => (teacherBatches.data ?? []).find((b) => b.batch_id === batchId) ?? null,
    [teacherBatches.data, batchId],
  );

  const canSave =
    selectedBatch !== null &&
    testName.trim().length >= 1 &&
    testDate.length === 10 &&
    Number.isFinite(maxScoreNum) &&
    maxScoreNum > 0;

  const submit = async () => {
    if (!selectedBatch || !canSave) {
      setInfo({
        tone: "err",
        msg: "Pick batch + test name + date + max score.",
      });
      return;
    }
    const rosterIds = (ofs.data?.roster ?? []).map((r) => r.student_id);
    const v = validateScoreEntries(rosterIds, scores, notes, maxScoreNum);
    if (!v.ok) {
      setInfo({ tone: "err", msg: v.errors[0] ?? "Validation failed." });
      return;
    }
    if (v.entries.length === 0) {
      setInfo({
        tone: "err",
        msg: "Enter at least one student's score before saving.",
      });
      return;
    }
    setInfo(null);
    try {
      const out = await upsert.mutateAsync({
        batch_id: selectedBatch.batch_id,
        test_name: testName.trim(),
        test_date: testDate,
        ...(subjectId ? { subject_id: subjectId } : {}),
        max_score: maxScoreNum,
        entries: v.entries,
      });
      setInfo({
        tone: "ok",
        msg: `${out?.inserted_count ?? 0} new, ${out?.updated_count ?? 0} updated.`,
      });
      await ofs.refetch();
    } catch (e) {
      setInfo({
        tone: "err",
        msg: e instanceof Error ? e.message : "Save failed.",
      });
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 pb-32">
      <header className="flex items-center gap-3">
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Back"
          onClick={() => router.back()}
        >
          <ChevronLeft />
        </Button>
        <h1 className="text-xl font-bold text-slate-900">Offline test scores</h1>
      </header>

      <section className="space-y-3 rounded-2xl border border-slate-100 bg-white p-4">
        <label className="block text-xs text-slate-500">
          Batch
          <select
            value={batchId ?? ""}
            onChange={(e) => {
              setBatchId(e.target.value || null);
              setSubjectId(null);
              setScores({});
              setNotes({});
            }}
            className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900"
            data-testid="offline-batch"
          >
            <option value="">Choose batch</option>
            {(teacherBatches.data ?? []).map((b) => (
              <option key={b.batch_id} value={b.batch_id}>
                {b.batch_name} · {b.course_code}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-slate-500">
          Test name
          <Input
            value={testName}
            onChange={(e) => setTestName(e.target.value)}
            placeholder="e.g. Weekly Test 12"
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs text-slate-500">
            Date
            <Input
              type="date"
              value={testDate}
              onChange={(e) => setTestDate(e.target.value)}
            />
          </label>
          <label className="block text-xs text-slate-500">
            Max score
            <Input
              type="number"
              value={maxScore}
              onChange={(e) => setMaxScore(e.target.value)}
            />
          </label>
        </div>
        <label className="block text-xs text-slate-500">
          Subject (optional)
          <select
            value={subjectId ?? ""}
            onChange={(e) => setSubjectId(e.target.value || null)}
            disabled={!batchId}
            className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 disabled:bg-slate-50 disabled:text-slate-400"
          >
            <option value="">None</option>
            {(subjects.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      </section>

      {!selectedBatch ? (
        <p className="italic text-slate-500">Pick a batch to load its roster.</p>
      ) : ofs.isLoading ? (
        <Skeleton className="h-32 rounded-2xl" />
      ) : (ofs.data?.roster ?? []).length === 0 ? (
        <p className="italic text-slate-500">No students in this batch yet.</p>
      ) : (
        <section className="space-y-2">
          <p className="text-base font-bold text-slate-900">
            Roster · {(ofs.data?.roster ?? []).length} student
            {(ofs.data?.roster ?? []).length === 1 ? "" : "s"}
          </p>
          <ul className="space-y-2">
            {(ofs.data?.roster ?? []).map((item) => {
              const existing = ofs.data?.existing.find(
                (e) => e.student_id === item.student_id,
              );
              return (
                <li
                  key={item.student_id}
                  className="rounded-2xl border border-slate-100 bg-white p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex size-9 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-primary">
                      {item.full_name.slice(0, 1).toUpperCase()}
                    </div>
                    <p className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900">
                      {item.full_name}
                    </p>
                    <Input
                      value={scores[item.student_id] ?? ""}
                      onChange={(e) =>
                        setScores((p) => ({
                          ...p,
                          [item.student_id]: e.target.value,
                        }))
                      }
                      inputMode="decimal"
                      placeholder="—"
                      className="w-20 text-right"
                      data-testid={`offline-score-${item.student_id}`}
                    />
                    <span className="ml-1 text-slate-400">
                      / {Number(maxScore) || 0}
                    </span>
                  </div>
                  {existing ? (
                    <p className="ml-12 mt-1 text-xs text-emerald-600">
                      Previous: {existing.score}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {info ? (
        <Pill tone={info.tone === "ok" ? "success" : "error"}>{info.msg}</Pill>
      ) : null}

      <div className="sticky bottom-0 -mx-4 border-t border-slate-100 bg-white/95 px-4 py-3 backdrop-blur">
        <Button
          onClick={submit}
          disabled={upsert.isPending || !canSave}
          className="w-full"
          size="lg"
          data-testid="offline-save-all"
        >
          {upsert.isPending ? (
            <Loader2 className="mr-1 size-3 animate-spin" />
          ) : (
            <Save className="mr-1 size-3" />
          )}
          Save all
        </Button>
      </div>
    </div>
  );
}
