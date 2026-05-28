"use client";

import { Check } from "lucide-react";
import { MathText } from "@/components/math/MathText";

export type OptionStatus =
  | "default"
  | "selected"
  | "correct"
  | "wrong"
  | "missed";

interface Props {
  letter: string;
  text_md: string;
  image_url?: string | null;
  status: OptionStatus;
  disabled?: boolean;
  onClick?: () => void;
}

const STATUS: Record<
  OptionStatus,
  { wrap: string; letterWrap: string; letterFg: string }
> = {
  default: {
    wrap: "border-slate-300 bg-white hover:border-slate-400",
    letterWrap: "bg-slate-100 text-slate-600",
    letterFg: "text-slate-600",
  },
  selected: {
    wrap: "border-primary bg-blue-50",
    letterWrap: "bg-primary text-white",
    letterFg: "text-white",
  },
  correct: {
    wrap: "border-emerald-600 bg-emerald-50",
    letterWrap: "bg-emerald-600 text-white",
    letterFg: "text-white",
  },
  wrong: {
    wrap: "border-red-600 bg-red-50",
    letterWrap: "bg-red-600 text-white",
    letterFg: "text-white",
  },
  missed: {
    wrap: "border-emerald-600 bg-white",
    letterWrap: "bg-emerald-100 text-emerald-800",
    letterFg: "text-emerald-800",
  },
};

export function OptionRadio({
  letter,
  text_md,
  image_url,
  status,
  disabled,
  onClick,
}: Props) {
  const s = STATUS[status];
  return (
    <button
      type="button"
      role="radio"
      aria-checked={status !== "default"}
      aria-disabled={disabled}
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
      className={`flex w-full items-start gap-3 rounded-2xl border-2 p-3 text-left transition disabled:cursor-default ${s.wrap}`}
      data-status={status}
    >
      <span
        className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${s.letterWrap}`}
        aria-label={`Option ${letter}`}
      >
        {status === "correct" ? (
          <Check className="size-4" />
        ) : (
          <span className={s.letterFg}>{letter}</span>
        )}
      </span>
      <div className="min-w-0 flex-1">
        {image_url ? (
          <div className="mb-2 overflow-hidden rounded-lg bg-slate-50">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image_url}
              alt="Option illustration"
              className="h-auto max-h-40 w-full object-contain"
            />
          </div>
        ) : null}
        <div className="text-sm text-slate-900">
          <MathText markdown={text_md} />
        </div>
      </div>
    </button>
  );
}
