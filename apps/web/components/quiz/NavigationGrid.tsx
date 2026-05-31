"use client";

import { memo } from "react";

export type QuestionStatus =
  | "current"
  | "answered"
  | "flagged_unanswered"
  | "flagged_answered"
  | "unanswered";

interface Props {
  total: number;
  currentIndex: number;
  statuses: QuestionStatus[];
  onJump: (index: number) => void;
}

function classFor(status: QuestionStatus): string {
  switch (status) {
    case "current":
      return "bg-primary text-white border-primary shadow-sm shadow-blue-200/50 ring-2 ring-primary/30";
    case "answered":
      return "bg-emerald-100 text-emerald-900 border-emerald-400 hover:border-emerald-500";
    case "flagged_answered":
      return "bg-red-100 text-red-900 border-red-400 hover:border-red-500";
    case "flagged_unanswered":
      return "bg-amber-100 text-amber-900 border-amber-400 hover:border-amber-500";
    default:
      return "bg-white text-slate-600 border-slate-300 hover:border-slate-400 hover:bg-slate-50";
  }
}

// One navigator cell, memoized on primitive props. With a stable `onJump`
// (useCallback in the parent, dispatch-backed), changing one question's status
// only re-renders that single cell instead of all N buttons — meaningful on a
// long exam on a low-end device. DOM + data-status + onClick semantics are
// identical to the previous inline-button version.
const NavCell = memo(function NavCell({
  index,
  status,
  isCurrent,
  onJump,
}: {
  index: number;
  status: QuestionStatus;
  isCurrent: boolean;
  onJump: (index: number) => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-label={`Go to question ${index + 1}`}
      aria-selected={isCurrent}
      onClick={() => onJump(index)}
      data-status={status}
      className={`flex size-10 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-1 ${classFor(status)}`}
    >
      {index + 1}
    </button>
  );
});

export function NavigationGrid({
  total,
  currentIndex,
  statuses,
  onJump,
}: Props) {
  return (
    <div
      className="flex gap-2 overflow-x-auto px-4 py-3"
      role="tablist"
      aria-label="Question navigator"
    >
      {Array.from({ length: total }, (_, i) => {
        const isCurrent = i === currentIndex;
        const status: QuestionStatus = isCurrent
          ? "current"
          : statuses[i] ?? "unanswered";
        return (
          <NavCell
            key={i}
            index={i}
            status={status}
            isCurrent={isCurrent}
            onJump={onJump}
          />
        );
      })}
    </div>
  );
}
