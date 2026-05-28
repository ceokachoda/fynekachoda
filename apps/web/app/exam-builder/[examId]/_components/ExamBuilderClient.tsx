"use client";

// Phase 4 Track 4B — teacher exam builder (FocusLayout). Mirrors mobile
// exam-builder. Atomic question replace (Phase-7 carry-over) prevents
// half-built published exams when a request mid-stream fails.

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Pill } from "@/components/fyne/Pill";
import { FocusLayout } from "@/components/fyne/FocusLayout";
import { QueryProvider } from "@/lib/query";
import { SessionProvider, useSession } from "@/features/auth/SessionProvider";
import { useTeacherExamBuilder } from "@/features/teacher/useTeacherExamBuilder";
import { useTeacherBatches } from "@/features/teacher/useTeacherBatches";
import { useQuestionBank } from "@/features/teacher/useQuestionBank";
import {
  buildExamQuestionReplacePlan,
  reorder,
} from "@/features/teacher/builder-question-replace";
import { QuestionBankSheet } from "@/components/teacher/QuestionBankSheet";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

interface Props {
  examId: string;
}

const DURATION_PRESETS = [15, 30, 45, 60, 90, 120, 180];

function fmtLocalDateTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  // datetime-local needs YYYY-MM-DDTHH:MM in the user's local zone.
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function nextHalfHourIso(): string {
  const ms = Date.now() + 60_000;
  const period = 30 * 60_000;
  return new Date(Math.ceil(ms / period) * period).toISOString();
}

export function ExamBuilderClient({ examId }: Props) {
  return (
    <FocusLayout className="bg-slate-50">
      <QueryProvider>
        <SessionProvider>
          <ExamBuilderInner examId={examId} />
        </SessionProvider>
      </QueryProvider>
    </FocusLayout>
  );
}

function ExamBuilderInner({ examId }: Props) {
  const router = useRouter();
  const { appUser } = useSession();
  const builder = useTeacherExamBuilder(examId);
  const teacherBatches = useTeacherBatches();
  const bank = useQuestionBank();

  const [title, setTitle] = useState("");
  const [batchId, setBatchId] = useState<string | null>(null);
  const [startsAt, setStartsAt] = useState<string | null>(null);
  const [durationMin, setDurationMin] = useState<number>(60);
  const [marksCorrect, setMarksCorrect] = useState("4");
  const [marksWrong, setMarksWrong] = useState("-1");
  const [marksSkip, setMarksSkip] = useState("0");
  const [resultRelease, setResultRelease] = useState<"manual" | "instant">("manual");
  const [questionIds, setQuestionIds] = useState<string[]>([]);
  const [showBank, setShowBank] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  useEffect(() => {
    const e = builder.data?.exam;
    if (!e) return;
    setTitle(e.title);
    setBatchId(e.batch_id);
    setStartsAt(e.starts_at);
    setDurationMin(e.duration_min);
    setMarksCorrect(String(e.marks_correct));
    setMarksWrong(String(e.marks_wrong));
    setMarksSkip(String(e.marks_skip));
    setResultRelease(e.result_release);
    setQuestionIds((builder.data?.questions ?? []).map((q) => q.question_id));
  }, [builder.data]);

  useEffect(() => {
    if (examId === "new" && !startsAt) setStartsAt(nextHalfHourIso());
  }, [examId, startsAt]);

  const selectedBatch = useMemo(
    () => (teacherBatches.data ?? []).find((b) => b.batch_id === batchId) ?? null,
    [teacherBatches.data, batchId],
  );

  const isPublished = builder.data?.exam.is_published ?? false;

  const canSave =
    title.trim().length > 0 &&
    batchId !== null &&
    startsAt !== null &&
    durationMin >= 1 &&
    durationMin <= 360;

  const save = async (publish: boolean) => {
    if (!appUser?.id || !canSave) {
      setErrMsg("Add title + batch + start + duration first.");
      return;
    }
    if (publish && questionIds.length === 0) {
      setErrMsg("Add at least one question before publishing.");
      return;
    }
    setSaving(true);
    setErrMsg(null);
    try {
      const payload = {
        title: title.trim(),
        batch_id: batchId,
        starts_at: startsAt,
        duration_min: durationMin,
        marks_correct: Number.parseFloat(marksCorrect) || 4,
        marks_wrong: Number.parseFloat(marksWrong) || -1,
        marks_skip: Number.parseFloat(marksSkip) || 0,
        result_release: resultRelease,
        is_published: publish,
        created_by: appUser.id,
      };
      const supabase = createSupabaseBrowserClient();
      let savedId = examId;
      if (examId === "new") {
        const ins = await supabase
          .from("exams")
          .insert(payload)
          .select("id")
          .single();
        if (ins.error || !ins.data) {
          throw new Error(ins.error?.message ?? "Could not insert exam.");
        }
        savedId = ins.data.id as string;
      } else {
        const upd = await supabase
          .from("exams")
          .update(payload)
          .eq("id", examId);
        if (upd.error) throw new Error(upd.error.message);
      }

      // Atomic replace — upsert THEN delete (never leaves the published exam empty).
      const plan = buildExamQuestionReplacePlan(savedId, questionIds);
      if (!plan.isEmpty) {
        const up = await supabase
          .from("exam_questions")
          .upsert(plan.upsertRows, { onConflict: "exam_id,question_id" });
        if (up.error) throw new Error(up.error.message);
        const del = await supabase
          .from("exam_questions")
          .delete()
          .eq("exam_id", savedId)
          .not("question_id", "in", `(${questionIds.join(",")})`);
        if (del.error) throw new Error(del.error.message);
      } else {
        const del = await supabase
          .from("exam_questions")
          .delete()
          .eq("exam_id", savedId);
        if (del.error) throw new Error(del.error.message);
      }
      router.push("/exams");
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  if (builder.isLoading && !builder.data) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 pb-32">
      <header className="flex items-center gap-3">
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Back"
          onClick={() => router.push("/exams")}
        >
          <ChevronLeft />
        </Button>
        <h1 className="text-xl font-bold text-slate-900">
          {examId === "new" ? "New exam" : "Edit exam"}
        </h1>
        {isPublished ? <Pill tone="warning">Published</Pill> : null}
      </header>

      {isPublished ? (
        <div className="flex items-start gap-2 rounded-2xl border border-yellow-300 bg-yellow-50 p-3">
          <AlertTriangle className="mt-0.5 size-4 text-yellow-700" />
          <p className="text-xs text-yellow-900">
            This exam is already published. Edits change the live experience —
            students who are mid-attempt see the new question set on refresh.
          </p>
        </div>
      ) : null}

      <section className="space-y-3 rounded-2xl border border-slate-100 bg-white p-4">
        <p className="text-base font-bold text-slate-900">Basics</p>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Unit Test 4 — Mechanics"
          data-testid="exam-builder-title"
        />
        <label className="block text-xs text-slate-500">
          Batch
          <select
            value={batchId ?? ""}
            onChange={(e) => setBatchId(e.target.value || null)}
            className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900"
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
          Starts at (IST shown in your browser&apos;s local time)
          <Input
            type="datetime-local"
            value={fmtLocalDateTime(startsAt)}
            onChange={(e) => {
              const v = e.target.value;
              if (!v) {
                setStartsAt(null);
                return;
              }
              const d = new Date(v);
              setStartsAt(d.toISOString());
            }}
          />
        </label>
        <label className="block text-xs text-slate-500">
          Duration
          <select
            value={durationMin}
            onChange={(e) => setDurationMin(Number.parseInt(e.target.value, 10))}
            className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900"
          >
            {DURATION_PRESETS.map((m) => (
              <option key={m} value={m}>
                {m} minutes
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-slate-500">
          Result release
          <select
            value={resultRelease}
            onChange={(e) =>
              setResultRelease(e.target.value as "manual" | "instant")
            }
            className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900"
          >
            <option value="manual">Manual (teacher releases later)</option>
            <option value="instant">Instant (release on submit)</option>
          </select>
        </label>
      </section>

      <section className="grid grid-cols-3 gap-3 rounded-2xl border border-slate-100 bg-white p-4">
        <NumField label="+ Correct" value={marksCorrect} onChange={setMarksCorrect} />
        <NumField label="− Wrong" value={marksWrong} onChange={setMarksWrong} />
        <NumField label="Skip" value={marksSkip} onChange={setMarksSkip} />
      </section>

      <section className="space-y-3 rounded-2xl border border-slate-100 bg-white p-4">
        <p className="text-base font-bold text-slate-900">
          Questions · {questionIds.length}
        </p>
        {questionIds.length === 0 ? (
          <p className="rounded-xl bg-slate-50 px-3 py-6 text-center text-sm italic text-slate-500">
            No questions yet. Add some from the bank below.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
            {questionIds.map((qid, i) => {
              const prompt =
                bank.data?.find((r) => r.id === qid)?.prompt_md ??
                builder.data?.questions.find((q) => q.question_id === qid)?.prompt_md ??
                `Question ${qid.slice(0, 8)}…`;
              return (
                <li
                  key={qid}
                  className="flex items-center gap-2 bg-slate-50 px-3 py-2"
                >
                  <span className="w-6 text-xs font-bold text-slate-500">
                    {i + 1}.
                  </span>
                  <p className="line-clamp-2 flex-1 text-sm text-slate-900">
                    {prompt}
                  </p>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={i === 0}
                    aria-label="Move up"
                    onClick={() =>
                      setQuestionIds((prev) => reorder(prev, i, -1))
                    }
                  >
                    <ChevronUp />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={i === questionIds.length - 1}
                    aria-label="Move down"
                    onClick={() =>
                      setQuestionIds((prev) => reorder(prev, i, 1))
                    }
                  >
                    <ChevronDown />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Remove"
                    onClick={() =>
                      setQuestionIds((prev) => prev.filter((x) => x !== qid))
                    }
                  >
                    <Trash2 className="text-red-600" />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
        <Button onClick={() => setShowBank(true)}>
          <Plus />
          Add from Question Bank
        </Button>
      </section>

      {errMsg ? (
        <p className="text-sm text-destructive" data-testid="builder-error">
          {errMsg}
        </p>
      ) : null}

      <div className="sticky bottom-0 -mx-4 flex gap-3 border-t border-slate-100 bg-white/95 px-4 py-3 backdrop-blur">
        <Button
          onClick={() => void save(false)}
          variant="outline"
          disabled={saving || !canSave}
          className="flex-1"
        >
          {saving ? <Loader2 className="mr-1 size-3 animate-spin" /> : null}
          Save draft
        </Button>
        <Button
          onClick={() => void save(true)}
          disabled={saving || !canSave}
          className="flex-1"
          data-testid="exam-builder-publish"
        >
          {saving ? <Loader2 className="mr-1 size-3 animate-spin" /> : null}
          Publish
        </Button>
      </div>

      {/* `selectedBatch` referenced so the builder's selected batch is visible
          for users skimming the form, and used as the topic-id scope hint for
          the bank in a future iteration. Kept on the surface intentionally. */}
      {selectedBatch ? (
        <p className="sr-only">Selected batch: {selectedBatch.batch_name}</p>
      ) : null}

      <QuestionBankSheet
        open={showBank}
        onOpenChange={setShowBank}
        topicId={null}
        alreadyIncluded={questionIds}
        onPicked={(items) => {
          setQuestionIds((prev) => {
            const next = prev.slice();
            for (const it of items) if (!next.includes(it.id)) next.push(it.id);
            return next;
          });
        }}
      />
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode="decimal"
      />
    </label>
  );
}
