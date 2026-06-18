"use client";

import { useCallback, useState, useTransition, type ReactNode } from "react";
import type {
  AttemptRow,
  NotAttemptedRow,
  QuestionAnalysisRow,
  QuizMeta,
  ResultsSummary,
  StudentResult,
} from "./page";
import {
  getQuizAttemptDetailAction,
  type AttemptDetail,
} from "./actions";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { ClipboardList, Users } from "lucide-react";

interface Props {
  meta: QuizMeta;
  summary: ResultsSummary;
  students: StudentResult[];
  notAttempted: NotAttemptedRow[];
  questionAnalysis: QuestionAnalysisRow[];
}

type Tab = "students" | "absent" | "questions";

function fmtIst(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function csvEscape(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function buildCsv(
  students: StudentResult[],
  notAttempted: NotAttemptedRow[],
): string {
  const header = [
    "student",
    "enrollment_no",
    "batch",
    "status",
    "attempt_no",
    "started_at",
    "submitted_at",
    "auto_submit",
    "score",
    "max_score",
    "pct",
    "correct",
    "wrong",
    "skipped",
  ].join(",");
  const lines: string[] = [];
  for (const s of students) {
    if (s.attempts.length === 0) continue;
    for (const a of s.attempts) {
      lines.push(
        [
          csvEscape(s.student_name),
          csvEscape(s.enrollment_no ?? ""),
          csvEscape(s.batch_name ?? ""),
          a.submitted_at ? "submitted" : "in_progress",
          a.attempt_no,
          a.started_at,
          a.submitted_at ?? "",
          a.is_auto_submit ? "yes" : "no",
          a.score ?? "",
          a.max_score ?? "",
          a.pct ?? "",
          a.correct_count ?? "",
          a.wrong_count ?? "",
          a.skipped_count ?? "",
        ].join(","),
      );
    }
  }
  for (const n of notAttempted) {
    lines.push(
      [
        csvEscape(n.student_name),
        csvEscape(n.enrollment_no ?? ""),
        csvEscape(n.batch_name ?? ""),
        "not_attempted",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
      ].join(","),
    );
  }
  return [header, ...lines].join("\n");
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-4 shadow-sm">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums text-foreground">
        {value}
      </div>
      {sub ? <div className="mt-1 text-[11px] text-muted-foreground">{sub}</div> : null}
    </div>
  );
}

function pctColor(p: number): string {
  return p >= 70 ? "#16a34a" : p >= 40 ? "#f59e0b" : "#dc2626";
}

export function QuizResultsClient({
  meta,
  summary,
  students,
  notAttempted,
  questionAnalysis,
}: Props) {
  const [tab, setTab] = useState<Tab>("students");

  const exportCsv = () => {
    const blob = new Blob([buildCsv(students, notAttempted)], {
      type: "text/csv;charset=utf-8",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `quiz-results-${meta.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={meta.title}
        breadcrumbs={[
          { label: "Overview", href: "/" },
          { label: "Quizzes", href: "/quizzes" },
          { label: meta.title }
        ]}
        description={`${meta.course_code} · ${meta.batch_name ?? "Course-wide"} · ${meta.question_count} questions · ${meta.duration_min} min · +${meta.marks_correct} / ${meta.marks_wrong} / ${meta.marks_skip}`}
        actions={
          <div className="flex items-center gap-3">
            <StatusBadge 
              status={meta.is_published ? "Published" : "Draft"} 
              variant={meta.is_published ? "success" : "default"} 
            />
            <Button variant="outline" onClick={exportCsv} className="h-9">
              Export CSV
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat
          label="Attempted"
          value={`${summary.submitted_students}`}
          sub={`of ${summary.roster_size} students`}
        />
        <Stat label="Not attempted" value={`${summary.not_attempted}`} />
        <Stat
          label="Submissions"
          value={`${summary.submitted_attempts}`}
          sub={`${summary.total_attempts} incl. in-progress`}
        />
        <Stat
          label="Avg score"
          value={summary.avg_score !== null ? `${summary.avg_score}` : "—"}
          sub={summary.avg_pct !== null ? `${summary.avg_pct}%` : undefined}
        />
        <Stat
          label="Highest"
          value={summary.high_score !== null ? `${summary.high_score}` : "—"}
        />
        <Stat
          label="Lowest"
          value={summary.low_score !== null ? `${summary.low_score}` : "—"}
        />
      </div>

      <div className="flex gap-1 border-b border-border">
        <TabBtn active={tab === "students"} onClick={() => setTab("students")}>
          Attempted ({summary.attempted_students})
        </TabBtn>
        <TabBtn active={tab === "absent"} onClick={() => setTab("absent")}>
          Not attempted ({summary.not_attempted})
        </TabBtn>
        <TabBtn active={tab === "questions"} onClick={() => setTab("questions")}>
          Question analysis
        </TabBtn>
      </div>

      {tab === "students" ? (
        <StudentsTab students={students} />
      ) : tab === "absent" ? (
        <AbsentTab rows={notAttempted} />
      ) : (
        <QuestionsTab rows={questionAnalysis} />
      )}
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "border-b-2 border-primary px-3 py-2 text-sm font-semibold text-primary"
          : "border-b-2 border-transparent px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
      }
    >
      {children}
    </button>
  );
}

/* ---------------- Students (attempted) ---------------- */

function StudentsTab({ students }: { students: StudentResult[] }) {
  if (students.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No attempts yet"
        description="No student has attempted this quiz yet."
      />
    );
  }
  return (
    <ul className="space-y-2">
      {students.map((s) => (
        <StudentCard key={s.student_id} student={s} />
      ))}
    </ul>
  );
}

function StudentCard({ student: s }: { student: StudentResult }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors"
      >
        <span className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
          {s.student_name.slice(0, 1).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-foreground">
            {s.student_name}
            {!s.in_roster ? (
              <span
                className="ml-2 rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600"
                title="Has an attempt but is not in this quiz's current audience"
              >
                outside audience
              </span>
            ) : null}
          </span>
          <span className="block truncate text-[11px] text-muted-foreground mt-0.5">
            {s.enrollment_no ? `${s.enrollment_no} · ` : ""}
            {s.batch_name ?? "—"} · {s.submitted_count} submitted ·{" "}
            {s.attempts.length} total attempt{s.attempts.length === 1 ? "" : "s"}
          </span>
        </span>
        <span className="text-right">
          <span className="block text-lg font-extrabold text-primary tabular-nums">
            {s.best_score !== null ? s.best_score : "—"}
            <span className="text-[11px] font-medium text-muted-foreground/70 ml-1">
              best
            </span>
          </span>
          <span className="block text-[11px] text-muted-foreground tabular-nums">
            {s.best_pct !== null ? `${s.best_pct}%` : "no submission"}
          </span>
        </span>
        <span className="ml-2 text-muted-foreground/50">{open ? "▲" : "▼"}</span>
      </button>

      {open ? (
        <div className="border-t border-border bg-muted/20 px-4 py-4">
          <ul className="space-y-3">
            {s.attempts.map((a) => (
              <AttemptCard key={a.id} attempt={a} studentName={s.student_name} />
            ))}
          </ul>
        </div>
      ) : null}
    </li>
  );
}

function AttemptCard({
  attempt: a,
  studentName,
}: {
  attempt: AttemptRow;
  studentName: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [detail, setDetail] = useState<AttemptDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const submitted = a.submitted_at !== null;

  const load = useCallback(() => {
    setErr(null);
    startTransition(async () => {
      const res = await getQuizAttemptDetailAction(a.id);
      if (res.error) setErr(res.error);
      else if (res.detail) setDetail(res.detail);
    });
  }, [a.id]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && submitted && !detail && !pending) load();
  };

  return (
    <li className="rounded-lg border border-border bg-card">
      <button
        type="button"
        onClick={toggle}
        disabled={!submitted}
        className="flex w-full items-center gap-3 px-3 py-2 text-left disabled:cursor-default hover:bg-muted/30 transition-colors rounded-t-lg"
      >
        <span className="text-xs font-bold text-muted-foreground">#{a.attempt_no}</span>
        <span className="min-w-0 flex-1">
          {submitted ? (
            <span className="block text-xs text-foreground/80">
              {a.correct_count ?? 0}✓ · {a.wrong_count ?? 0}✗ ·{" "}
              {a.skipped_count ?? 0} skipped · {fmtIst(a.submitted_at)}
              {a.is_auto_submit ? " · auto" : ""}
            </span>
          ) : (
            <span className="block text-xs italic text-amber-600 dark:text-amber-500">
              In progress (started {fmtIst(a.started_at)}) — not submitted
            </span>
          )}
        </span>
        <span className="text-right">
          <span className="block text-sm font-bold text-foreground tabular-nums">
            {a.score !== null ? a.score : "—"}
            <span className="text-[11px] font-medium text-muted-foreground">
              /{a.max_score ?? 0}
            </span>
          </span>
          <span className="block text-[11px] text-muted-foreground tabular-nums">
            {a.pct !== null ? `${a.pct}%` : ""}
          </span>
        </span>
        {submitted ? (
          <span className="ml-1 text-muted-foreground/50">{open ? "▲" : "▼"}</span>
        ) : (
          <span className="ml-1 w-3" />
        )}
      </button>

      {open && submitted ? (
        <div className="border-t border-border px-3 py-3">
          {pending && !detail ? (
            <p className="text-xs text-muted-foreground">Loading answer breakdown…</p>
          ) : err ? (
            <div className="flex items-center justify-between gap-2 rounded border border-destructive bg-destructive/15 px-3 py-2 text-xs text-destructive">
              <span>{err}</span>
              <button
                type="button"
                onClick={load}
                className="rounded border border-destructive/50 px-2 py-0.5 font-medium hover:bg-destructive/20"
              >
                Retry
              </button>
            </div>
          ) : detail ? (
            <AttemptDetailView detail={detail} studentName={studentName} />
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

function AttemptDetailView({
  detail,
  studentName,
}: {
  detail: AttemptDetail;
  studentName: string;
}) {
  return (
    <div className="space-y-3">
      <p className="text-[11px] text-muted-foreground">
        {studentName}&apos;s answers · {detail.questions.length} questions
      </p>
      <ol className="space-y-3">
        {detail.questions.map((q, i) => {
          const tone =
            q.outcome === "correct"
              ? { label: "Correct", bg: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" }
              : q.outcome === "wrong"
                ? { label: "Wrong", bg: "bg-destructive/15 text-destructive border-destructive/30" }
                : { label: "Skipped", bg: "bg-muted text-muted-foreground border-border" };
          return (
            <li
              key={q.id}
              className="rounded-lg border border-border bg-card p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="text-xs font-bold text-muted-foreground mt-0.5">
                    Q{i + 1}
                  </span>
                  <span className="text-sm text-foreground">{q.prompt_md}</span>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold border ${tone.bg}`}
                >
                  {tone.label} ({q.points > 0 ? "+" : ""}
                  {q.points})
                </span>
              </div>
              {q.prompt_image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={q.prompt_image_url}
                  alt=""
                  className="mt-3 max-h-48 rounded border border-border"
                />
              ) : null}
              <ul className="mt-3 space-y-1.5">
                {q.options.map((o) => {
                  const isChosen = o.id === q.your_option_id;
                  const isCorrect = o.is_correct;
                  const border = isCorrect
                    ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                    : isChosen
                      ? "border-destructive/50 bg-destructive/10 text-destructive"
                      : "border-border bg-transparent text-foreground";
                  return (
                    <li
                      key={o.id}
                      className={`flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-xs transition-colors ${border}`}
                    >
                      <span>{o.text_md}</span>
                      <span className="flex shrink-0 gap-1.5">
                        {isChosen ? (
                          <span className="rounded bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                            Their choice
                          </span>
                        ) : null}
                        {isCorrect ? (
                          <span className="rounded bg-emerald-600 dark:bg-emerald-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                            Correct
                          </span>
                        ) : null}
                      </span>
                    </li>
                  );
                })}
              </ul>
              {q.explanation_md ? (
                <p className="mt-3 rounded-md bg-muted/50 px-3 py-2 text-[11px] text-muted-foreground leading-relaxed">
                  <span className="font-semibold text-foreground">Explanation: </span>
                  {q.explanation_md}
                </p>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/* ---------------- Not attempted ---------------- */

function AbsentTab({ rows }: { rows: NotAttemptedRow[] }) {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="Everyone participated"
        description="Everyone in this quiz's audience has attempted it. 🎉"
      />
    );
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted border-b border-border text-left text-[11px] uppercase text-muted-foreground tracking-wide">
          <tr>
            <th className="px-3 py-2">Student</th>
            <th className="px-3 py-2">Enrollment</th>
            <th className="px-3 py-2">Batch</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r) => (
            <tr key={r.student_id} className="hover:bg-muted/30 transition-colors">
              <td className="px-3 py-3 font-medium text-foreground">
                {r.student_name}
              </td>
              <td className="px-3 py-3 text-muted-foreground">
                {r.enrollment_no ?? "—"}
              </td>
              <td className="px-3 py-3 text-muted-foreground">{r.batch_name ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------- Question analysis ---------------- */

function QuestionsTab({ rows }: { rows: QuestionAnalysisRow[] }) {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="No questions"
        description="This quiz has no questions."
      />
    );
  }
  return (
    <ul className="space-y-3">
      {rows.map((q, i) => {
        const color = pctColor(q.pct_correct);
        return (
          <li
            key={q.question_id}
            className="rounded-xl border border-border bg-card p-4 shadow-sm"
          >
            <div className="flex items-start gap-3">
              <span className="text-xs font-bold text-muted-foreground mt-0.5">Q{i + 1}</span>
              <span className="line-clamp-2 flex-1 text-sm text-foreground leading-relaxed">
                {q.prompt_md}
              </span>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${q.pct_correct}%`, backgroundColor: color }}
                />
              </div>
              <span
                className="w-12 text-right text-sm font-bold tabular-nums"
                style={{ color }}
              >
                {q.pct_correct}%
              </span>
            </div>
            <p className="mt-1.5 text-[11px] text-muted-foreground tabular-nums">
              {q.correct_attempts}/{q.total_attempts} attempts correct
            </p>
          </li>
        );
      })}
    </ul>
  );
}
