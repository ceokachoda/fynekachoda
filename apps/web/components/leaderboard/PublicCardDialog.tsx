"use client";

import { Flame, Award } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PublicCard } from "@/features/leaderboard/useLeaderboard";

export function PublicCardDialog({
  open,
  card,
  loading,
  onOpenChange,
}: {
  open: boolean;
  card: PublicCard | null;
  loading: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-[28px] p-6">
        <DialogTitle className="sr-only">Student card</DialogTitle>
        {loading ? (
          <div className="py-8 text-center text-sm text-slate-500">
            Loading card…
          </div>
        ) : !card ? (
          <div className="py-8 text-center">
            <p className="text-sm font-semibold text-slate-700">Card unavailable</p>
            <p className="mt-1 text-xs text-slate-500">
              This student may have left your batch.
            </p>
          </div>
        ) : (
          <div>
            <div className="mb-4 flex items-center gap-3">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-blue-100">
                <span className="text-base font-extrabold text-primary">
                  {card.full_name.charAt(0)?.toUpperCase() ?? "S"}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-extrabold text-slate-900">
                  {card.full_name}
                </p>
                <p className="text-xs text-slate-500">{card.batch_name}</p>
              </div>
            </div>
            <div className="mb-4 flex items-center gap-2 rounded-2xl bg-amber-50 px-3 py-2">
              <Flame className="size-4 text-amber-600" />
              <span className="text-sm font-bold text-amber-700">
                {card.streak} day streak
              </span>
            </div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
              Badges earned
            </p>
            {card.badges.length === 0 ? (
              <p className="rounded-2xl bg-slate-50 px-4 py-4 text-center text-xs text-slate-500">
                No badges yet.
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {card.badges.map((b) => (
                  <div
                    key={b.code}
                    className="flex flex-col items-center rounded-2xl bg-slate-50 p-2"
                  >
                    <Award className="mb-1 size-6 text-violet-500" />
                    <p className="text-center text-[11px] font-semibold text-slate-700 line-clamp-2">
                      {b.name}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
