"use client";

import { MathText } from "@/components/math/MathText";

interface Props {
  index: number;
  total: number;
  prompt_md: string;
  prompt_image_url?: string | null;
  difficulty?: "easy" | "medium" | "hard" | null;
}

const DIFFICULTY: Record<string, { bg: string; fg: string; label: string }> = {
  easy: { bg: "bg-emerald-100", fg: "text-emerald-800", label: "EASY" },
  medium: { bg: "bg-amber-100", fg: "text-amber-800", label: "MEDIUM" },
  hard: { bg: "bg-red-100", fg: "text-red-800", label: "HARD" },
};

export function QuestionCard({
  index,
  total,
  prompt_md,
  prompt_image_url,
  difficulty,
}: Props) {
  const d = difficulty ? DIFFICULTY[difficulty] : null;
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-500">
          Q{index + 1} / {total}
        </p>
        {d ? (
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${d.bg} ${d.fg}`}
          >
            {d.label}
          </span>
        ) : null}
      </div>
      <div className="text-base leading-relaxed text-slate-900">
        <MathText markdown={prompt_md} />
      </div>
      {prompt_image_url ? (
        <div className="mt-3 overflow-hidden rounded-xl bg-slate-50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={prompt_image_url}
            alt="Question illustration"
            className="h-auto max-h-72 w-full object-contain"
          />
        </div>
      ) : null}
    </div>
  );
}
