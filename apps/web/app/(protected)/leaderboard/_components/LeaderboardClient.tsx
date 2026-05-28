"use client";

import { useState } from "react";
import { Trophy, Info } from "lucide-react";
import { Segmented } from "@/components/fyne/Segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { RankRow } from "@/components/leaderboard/RankRow";
import { LeaderboardCalcModal } from "@/components/leaderboard/LeaderboardCalcModal";
import { PublicCardDialog } from "@/components/leaderboard/PublicCardDialog";
import {
  useLeaderboard,
  fetchStudentCard,
  type LeaderboardScope,
  type PublicCard,
} from "@/features/leaderboard/useLeaderboard";
import { useMyBatch } from "@/features/org/useMyBatch";

export function LeaderboardClient() {
  const [scope, setScope] = useState<LeaderboardScope>("weekly");
  const board = useLeaderboard(scope);
  const batch = useMyBatch();
  const [calcOpen, setCalcOpen] = useState(false);
  const [cardOpen, setCardOpen] = useState(false);
  const [cardLoading, setCardLoading] = useState(false);
  const [card, setCard] = useState<PublicCard | null>(null);

  const onRowPress = async (id: string) => {
    setCardOpen(true);
    setCard(null);
    setCardLoading(true);
    const c = await fetchStudentCard(id);
    setCardLoading(false);
    setCard(c);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-amber-100">
          <Trophy className="size-6 text-amber-600" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-extrabold text-slate-900">Leaderboard</h1>
          <p className="text-sm text-slate-500">
            {batch.data?.batch_name ?? "Your batch"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCalcOpen(true)}
          aria-label="How rank is calculated"
          className="flex size-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200"
        >
          <Info className="size-4" />
        </button>
      </div>

      <Segmented<LeaderboardScope>
        value={scope}
        onChange={setScope}
        options={[
          { value: "weekly", label: "Weekly" },
          { value: "alltime", label: "All-time" },
        ]}
        ariaLabel="Leaderboard scope"
      />

      {board.data?.me ? (
        <div className="rounded-2xl bg-blue-900 p-4 text-white">
          <p className="text-[11px] font-bold uppercase tracking-widest text-blue-200">
            Your rank
          </p>
          <div className="mt-2 flex items-end justify-between">
            <p className="text-3xl font-extrabold">
              #{board.data.me.rank}{" "}
              <span className="text-base font-normal text-blue-200">
                / {board.data.total}
              </span>
            </p>
            <p className="text-2xl font-extrabold">
              {board.data.me.composite.toFixed(2)}
            </p>
          </div>
        </div>
      ) : null}

      {board.isLoading ? (
        <>
          <Skeleton className="h-14 w-full rounded-2xl" />
          <Skeleton className="h-14 w-full rounded-2xl" />
          <Skeleton className="h-14 w-full rounded-2xl" />
        </>
      ) : board.error ? (
        <p className="rounded-2xl bg-red-50 p-4 text-sm text-red-700">
          Couldn&apos;t load the leaderboard.
        </p>
      ) : (board.data?.rows ?? []).length === 0 ? (
        <div className="rounded-2xl bg-slate-50 p-6 text-center">
          <Trophy className="mx-auto mb-2 size-8 text-slate-400" />
          <p className="text-sm font-semibold text-slate-700">
            No rankings yet
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Earn points by attending classes and topping quizzes.
          </p>
        </div>
      ) : (
        <div>
          {(board.data?.rows ?? []).map((row) => (
            <RankRow key={row.student_id} row={row} onPress={onRowPress} />
          ))}
        </div>
      )}

      <LeaderboardCalcModal open={calcOpen} onOpenChange={setCalcOpen} />
      <PublicCardDialog
        open={cardOpen}
        card={card}
        loading={cardLoading}
        onOpenChange={setCardOpen}
      />
    </div>
  );
}
