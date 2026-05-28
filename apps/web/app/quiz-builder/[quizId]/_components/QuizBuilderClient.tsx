"use client";

// Phase 4 Track 4B — teacher quiz builder (FocusLayout). New ("new") or edit
// (uuid). Hydrates via useTeacherQuizBuilder; saves via direct RLS writes
// (teacher `quizzes_*` policies authorize; `quiz-admin-mutate` is admin-only,
// confirmed via apps/functions/quiz-admin-mutate/index.ts:36 — that's why we
// don't use it here, matching mobile precedent).
// Q+EQ replace uses the atomic plan: upsert desired set, THEN delete rows
// outside the set, so a publish failure never leaves the quiz empty.

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Loader2,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { FocusLayout } from "@/components/fyne/FocusLayout";
import { CurriculumPicker } from "@/components/teacher/CurriculumPicker";
import { QuestionBankSheet } from "@/components/teacher/QuestionBankSheet";
import { QueryProvider } from "@/lib/query";
import { SessionProvider, useSession } from "@/features/auth/SessionProvider";
import { useTeacherQuizBuilder } from "@/features/teacher/useTeacherQuizBuilder";
import { useTeacherCurriculum } from "@/features/teacher/useTeacherCurriculum";
import {
  buildQuizQuestionReplacePlan,
  reorder,
} from "@/features/teacher/builder-question-replace";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

interface Props {
  quizId: string;
}

export function QuizBuilderClient({ quizId }: Props) {
  return (
    <FocusLayout className="bg-slate-50">
      <QueryProvider>
        <SessionProvider>
          <QuizBuilderInner quizId={quizId} />
        </SessionProvider>
      </QueryProvider>
    </FocusLayout>
  );
}

function QuizBuilderInner({ quizId }: Props) {
  const router = useRouter();
  const { appUser } = useSession();
  const builder = useTeacherQuizBuilder(quizId);
  const curriculum = useTeacherCurriculum();

  const [title, setTitle] = useState("");
  const [courseId, setCourseId] = useState<string | null>(null);
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [chapterId, setChapterId] = useState<string | null>(null);
  const [topicId, setTopicId] = useState<string | null>(null);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [durationMin, setDurationMin] = useState("20");
  const [marksCorrect, setMarksCorrect] = useState("4");
  const [marksWrong, setMarksWrong] = useState("-1");
  const [marksSkip, setMarksSkip] = useState("0");
  const [questionIds, setQuestionIds] = useState<string[]>([]);
  const [promptById, setPromptById] = useState<Record<string, string>>({});
  const [showBank, setShowBank] = useState(false);
  const [saving, setSaving] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  // Hydrate from loaded quiz.
  useEffect(() => {
    const q = builder.data?.quiz;
    if (!q) return;
    setTitle(q.title);
    setCourseId(q.scope.course_id);
    setBatchId(q.scope.batch_id);
    setTopicId(q.scope.topic_id);
    setDurationMin(String(q.duration_min));
    setMarksCorrect(String(q.marks_correct));
    setMarksWrong(String(q.marks_wrong));
    setMarksSkip(String(q.marks_skip));
    const qs = builder.data?.questions ?? [];
    setQuestionIds(qs.map((r) => r.question_id));
    setPromptById((m) => {
      const n = { ...m };
      for (const r of qs) n[r.question_id] = r.prompt_md;
      return n;
    });
  }, [builder.data]);

  // Back-derive subject + chapter when only topic_id is hydrated.
  useEffect(() => {
    if (!topicId || subjectId || !curriculum.data?.length) return;
    for (const c of curriculum.data) {
      for (const s of c.subjects) {
        for (const ch of s.chapters) {
          for (const t of ch.topics) {
            if (t.id === topicId) {
              setCourseId(c.course_id);
              setSubjectId(s.id);
              setChapterId(ch.id);
              return;
            }
          }
        }
      }
    }
  }, [topicId, subjectId, curriculum.data]);

  // Auto-pick the only course.
  useEffect(() => {
    if (courseId) return;
    const courses = curriculum.data;
    if (courses && courses.length === 1) {
      setCourseId(courses[0]!.course_id);
    }
  }, [courseId, curriculum.data]);

  const canSave = useMemo(() => {
    const d = Number.parseInt(durationMin, 10);
    return (
      title.trim().length > 0 &&
      topicId !== null &&
      courseId !== null &&
      d >= 1 &&
      d <= 240
    );
  }, [title, topicId, courseId, durationMin]);

  const save = async (publish: boolean) => {
    if (!appUser?.id || !canSave) {
      setErrMsg("Add title + topic + duration.");
      return;
    }
    if (publish && questionIds.length === 0) {
      setErrMsg("Add at least one question before publishing.");
      return;
    }
    setSaving(true);
    setErrMsg(null);
    setInfo(null);
    try {
      const payload = {
        title: title.trim(),
        topic_id: topicId,
        chapter_id: chapterId,
        batch_id: batchId,
        course_id: courseId,
        duration_min: Number.parseInt(durationMin, 10),
        marks_correct: Number.parseFloat(marksCorrect),
        marks_wrong: Number.parseFloat(marksWrong),
        marks_skip: Number.parseFloat(marksSkip),
        is_published: publish,
        created_by: appUser.id,
      };
      const supabase = createSupabaseBrowserClient();
      let savedId = quizId;
      if (quizId === "new") {
        const ins = await supabase
          .from("quizzes")
          .insert(payload)
          .select("id")
          .single();
        if (ins.error || !ins.data) {
          throw new Error(ins.error?.message ?? "Could not insert quiz.");
        }
        savedId = ins.data.id as string;
      } else {
        const upd = await supabase
          .from("quizzes")
          .update(payload)
          .eq("id", quizId);
        if (upd.error) throw new Error(upd.error.message);
      }

      // Atomic question replace (Phase-7 carry-over).
      const plan = buildQuizQuestionReplacePlan(savedId, questionIds);
      if (!plan.isEmpty) {
        const up = await supabase
          .from("quiz_questions")
          .upsert(plan.upsertRows, { onConflict: "quiz_id,question_id" });
        if (up.error) throw new Error(up.error.message);
        const del = await supabase
          .from("quiz_questions")
          .delete()
          .eq("quiz_id", savedId)
          .not("question_id", "in", `(${questionIds.join(",")})`);
        if (del.error) throw new Error(del.error.message);
      } else {
        const del = await supabase
          .from("quiz_questions")
          .delete()
          .eq("quiz_id", savedId);
        if (del.error) throw new Error(del.error.message);
      }
      setInfo(publish ? "Published." : "Draft saved.");
      router.push("/quizzes");
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const moveQuestion = (i: number, dir: -1 | 1) => {
    setQuestionIds((prev) => reorder(prev, i, dir));
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
          onClick={() => router.push("/quizzes")}
        >
          <ChevronLeft />
        </Button>
        <h1 className="text-xl font-bold text-slate-900">
          {quizId === "new" ? "New quiz" : "Edit quiz"}
        </h1>
      </header>

      <section className="space-y-3 rounded-2xl border border-slate-100 bg-white p-4">
        <label className="block">
          <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">
            Title
          </p>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Vectors — Quick 15"
            data-testid="quiz-builder-title"
          />
        </label>
      </section>

      <section className="space-y-3 rounded-2xl border border-slate-100 bg-white p-4">
        <p className="text-[11px] font-bold uppercase text-slate-500">Scope</p>
        <CurriculumPicker
          courses={curriculum.data ?? []}
          courseId={courseId}
          subjectId={subjectId}
          chapterId={chapterId}
          topicId={topicId}
          batchId={batchId}
          showBatch
          batchLabel="Batch (optional — empty = course-wide)"
          allowCourseWide
          onChange={(next) => {
            setCourseId(next.courseId);
            setSubjectId(next.subjectId);
            setChapterId(next.chapterId);
            setTopicId(next.topicId);
            setBatchId(next.batchId);
          }}
        />
      </section>

      <section className="grid grid-cols-2 gap-3 rounded-2xl border border-slate-100 bg-white p-4 sm:grid-cols-4">
        <NumField label="Duration (min)" value={durationMin} onChange={setDurationMin} />
        <NumField label="Correct" value={marksCorrect} onChange={setMarksCorrect} />
        <NumField label="Wrong" value={marksWrong} onChange={setMarksWrong} />
        <NumField label="Skip" value={marksSkip} onChange={setMarksSkip} />
      </section>

      <section className="space-y-3 rounded-2xl border border-slate-100 bg-white p-4">
        <p className="text-[11px] font-bold uppercase text-slate-500">
          Questions ({questionIds.length})
        </p>
        {questionIds.length === 0 ? (
          <p className="rounded-xl bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">
            No questions yet — add from the bank below.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
            {questionIds.map((qid, i) => (
              <li
                key={qid}
                className="flex items-center gap-2 bg-white px-3 py-2"
              >
                <span className="w-6 text-xs font-bold text-slate-500">
                  {i + 1}.
                </span>
                <p className="line-clamp-1 flex-1 text-sm text-slate-900">
                  {promptById[qid] ?? `Question ${qid.slice(0, 6)}…`}
                </p>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={i === 0}
                  aria-label="Move up"
                  onClick={() => moveQuestion(i, -1)}
                >
                  <ChevronUp />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={i === questionIds.length - 1}
                  aria-label="Move down"
                  onClick={() => moveQuestion(i, 1)}
                >
                  <ChevronDown />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Remove question"
                  onClick={() =>
                    setQuestionIds((prev) => prev.filter((x) => x !== qid))
                  }
                >
                  <Trash2 className="text-red-600" />
                </Button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => {
              if (!topicId) {
                setErrMsg("Pick a topic first.");
                return;
              }
              setShowBank(true);
            }}
            variant="outline"
          >
            <Plus />
            New question
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              if (!topicId) {
                setErrMsg("Pick a topic first.");
                return;
              }
              setShowBank(true);
            }}
          >
            <Search />
            From bank
          </Button>
        </div>
        <p className="text-xs text-slate-500">
          Inline single-question editor lands in Phase 5 — use the question bank
          (or seed from a mobile/admin authored question) for now.
        </p>
      </section>

      {errMsg ? (
        <p className="text-sm text-destructive" data-testid="builder-error">
          {errMsg}
        </p>
      ) : null}
      {info ? <p className="text-sm text-emerald-600">{info}</p> : null}

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
          data-testid="quiz-builder-publish"
        >
          {saving ? <Loader2 className="mr-1 size-3 animate-spin" /> : null}
          Publish
        </Button>
      </div>

      <QuestionBankSheet
        open={showBank}
        onOpenChange={setShowBank}
        topicId={topicId}
        alreadyIncluded={questionIds}
        onPicked={(items) => {
          setQuestionIds((prev) => {
            const next = prev.slice();
            for (const it of items) if (!next.includes(it.id)) next.push(it.id);
            return next;
          });
          setPromptById((m) => {
            const n = { ...m };
            for (const it of items) n[it.id] = it.prompt_md;
            return n;
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
