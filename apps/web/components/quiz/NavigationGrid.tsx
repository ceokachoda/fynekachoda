"use client";

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
      return "bg-primary text-white border-primary";
    case "answered":
      return "bg-emerald-100 text-emerald-900 border-emerald-400";
    case "flagged_answered":
      return "bg-red-100 text-red-900 border-red-400";
    case "flagged_unanswered":
      return "bg-amber-100 text-amber-900 border-amber-400";
    default:
      return "bg-white text-slate-600 border-slate-300";
  }
}

export function NavigationGrid({
  total,
  currentIndex,
  statuses,
  onJump,
}: Props) {
  // Map each cell to its computed status, then pre-classes so the snapshot
  // makes the navigationGridState unit test trivial. Mirrors the mobile
  // colourFor map verbatim.
  return (
    <div
      className="flex gap-2 overflow-x-auto px-4 py-3"
      role="tablist"
      aria-label="Question navigator"
    >
      {Array.from({ length: total }, (_, i) => {
        const status: QuestionStatus =
          i === currentIndex ? "current" : statuses[i] ?? "unanswered";
        return (
          <button
            key={i}
            type="button"
            role="tab"
            aria-label={`Go to question ${i + 1}`}
            aria-selected={i === currentIndex}
            onClick={() => onJump(i)}
            data-status={status}
            className={`flex size-9 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold ${classFor(status)}`}
          >
            {i + 1}
          </button>
        );
      })}
    </div>
  );
}
