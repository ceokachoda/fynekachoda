"use client";

import { memo } from "react";
import { RankBadge } from "./RankBadge";
import type { LeaderRow } from "@/features/leaderboard/useLeaderboard";

// Memoized: opening the public-card dialog (or any leaderboard-level state
// change) must not re-render every row. With a stable `onPress` (useCallback in
// the parent), a row only re-renders when its own `row` data actually changes.
export const RankRow = memo(function RankRow({
  row,
  onPress,
}: {
  row: LeaderRow;
  onPress: (id: string) => void;
}) {
  const phone = row.phone_last2 ? `••${row.phone_last2}` : null;
  return (
    <button
      type="button"
      onClick={() => onPress(row.student_id)}
      className={`flex w-full items-center rounded-2xl border px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 ${
        row.is_me
          ? "border-blue-300 bg-blue-50 shadow-sm shadow-blue-200/30"
          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
      }`}
    >
      <div className="flex w-9 items-center justify-center">
        <RankBadge rank={row.rank} />
      </div>
      <div className="ml-3 min-w-0 flex-1">
        <p
          className={`truncate text-sm font-bold ${
            row.is_me ? "text-blue-900" : "text-slate-900"
          }`}
        >
          {row.is_me ? "You" : row.full_name}
        </p>
        {phone ? (
          <p className="mt-0.5 text-xs font-medium text-slate-500">{phone}</p>
        ) : null}
      </div>
      <span className="text-sm font-extrabold tabular-nums text-blue-800">
        {row.composite.toFixed(2)}
      </span>
    </button>
  );
});
