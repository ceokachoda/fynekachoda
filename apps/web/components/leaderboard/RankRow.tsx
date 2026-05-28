"use client";

import { RankBadge } from "./RankBadge";
import type { LeaderRow } from "@/features/leaderboard/useLeaderboard";

export function RankRow({
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
      className={`mb-2 flex w-full items-center rounded-2xl border px-4 py-3 text-left transition ${
        row.is_me
          ? "border-blue-200 bg-blue-50"
          : "border-slate-100 bg-white hover:border-slate-200"
      }`}
    >
      <div className="flex w-9 items-center justify-center">
        <RankBadge rank={row.rank} />
      </div>
      <div className="ml-3 min-w-0 flex-1">
        <p
          className={`truncate text-sm font-bold ${
            row.is_me ? "text-blue-800" : "text-slate-900"
          }`}
        >
          {row.is_me ? "You" : row.full_name}
        </p>
        {phone ? (
          <p className="mt-0.5 text-[11px] text-slate-400">{phone}</p>
        ) : null}
      </div>
      <span className="text-sm font-extrabold text-blue-800">
        {row.composite.toFixed(2)}
      </span>
    </button>
  );
}
