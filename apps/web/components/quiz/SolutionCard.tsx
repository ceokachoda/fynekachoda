"use client";

import { useRouter } from "next/navigation";
import { ExternalLink, FileText, PlayCircle } from "lucide-react";
import { MathText } from "@/components/math/MathText";
import { OptionRadio, type OptionStatus } from "@/components/quiz/OptionRadio";
import { QuestionCard } from "@/components/quiz/QuestionCard";
import type { SolutionQuestion } from "@/features/quiz/types";
import type { ExamSolutionQuestion } from "@/features/exams/types";

interface Props {
  index: number;
  total: number;
  q: SolutionQuestion | ExamSolutionQuestion;
}

const LETTERS = ["A", "B", "C", "D", "E", "F"];

export function SolutionCard({ index, total, q }: Props) {
  const router = useRouter();
  return (
    <article className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
      <QuestionCard
        index={index}
        total={total}
        prompt_md={q.prompt_md}
        prompt_image_url={q.prompt_image_url}
        difficulty={q.difficulty}
      />
      <div className="space-y-2">
        {q.options.map((o, i) => {
          let status: OptionStatus = "default";
          if (o.id === q.correct_option_id) {
            status = q.your_option_id === o.id ? "correct" : "missed";
          } else if (o.id === q.your_option_id) {
            status = "wrong";
          }
          return (
            <OptionRadio
              key={o.id}
              letter={LETTERS[i] ?? String(i + 1)}
              text_md={o.text_md}
              image_url={o.image_url}
              status={status}
              disabled
            />
          );
        })}
      </div>
      <div className="rounded-xl bg-slate-50 p-3">
        <p className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">
          Explanation
        </p>
        {q.explanation_md ? (
          <div className="text-sm text-slate-900">
            <MathText markdown={q.explanation_md} />
          </div>
        ) : (
          <p className="text-sm italic text-slate-500">
            No explanation provided.
          </p>
        )}
        {q.related_content ? (
          <button
            type="button"
            onClick={() => {
              const href =
                q.related_content!.kind === "video"
                  ? `/video/${q.related_content!.id}`
                  : `/pdf/${q.related_content!.id}`;
              router.push(href);
            }}
            className="mt-3 inline-flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left"
          >
            {q.related_content.kind === "video" ? (
              <PlayCircle className="size-4 text-red-500" />
            ) : (
              <FileText className="size-4 text-emerald-600" />
            )}
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900">
              Related: {q.related_content.title}
            </span>
            <ExternalLink className="size-3.5 text-slate-400" />
          </button>
        ) : null}
      </div>
      <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-xs">
        <span
          className={`font-bold uppercase tracking-wide ${
            q.outcome === "correct"
              ? "text-emerald-700"
              : q.outcome === "wrong"
                ? "text-red-700"
                : "text-slate-500"
          }`}
          data-outcome={q.outcome}
        >
          {q.outcome === "correct"
            ? "Correct"
            : q.outcome === "wrong"
              ? "Wrong"
              : "Skipped"}
          {" "}
          ({q.points >= 0 ? "+" : ""}
          {q.points})
        </span>
        {q.is_flagged ? (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 font-bold text-amber-800">
            FLAGGED
          </span>
        ) : null}
      </div>
    </article>
  );
}
