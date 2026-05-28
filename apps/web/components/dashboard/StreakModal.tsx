"use client";

import { Flame } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { useStreak } from "@/features/dashboard/useStreak";
import { lastNIstDates } from "@/lib/ist";

function flameColor(days: number): string {
  if (days <= 0) return "#94a3b8";
  if (days < 7) return "#f97316";
  if (days < 30) return "#ea580c";
  if (days < 90) return "#dc2626";
  return "#eab308";
}

export function StreakModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { data, isLoading } = useStreak();
  const currentDays = data?.currentDays ?? 0;
  const bestDays = data?.bestDays ?? 0;
  const activeSet = new Set(data?.activeDays ?? []);
  const days = lastNIstDates(30);
  const todayYmd = days[days.length - 1];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-[28px] p-6">
        <DialogTitle className="mb-3 text-lg font-extrabold text-slate-900">
          Your streak
        </DialogTitle>
        <div className="mb-5 flex flex-col items-center">
          <Flame
            className="size-12"
            style={{ color: flameColor(currentDays) }}
          />
          <p className="mt-2 text-4xl font-extrabold text-slate-900">
            {currentDays}
          </p>
          <p className="text-sm text-slate-500">day streak</p>
          <p className="mt-1 text-xs text-slate-400">
            Best streak: {bestDays} days
          </p>
        </div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
          Last 30 days
        </p>
        {isLoading ? (
          <div className="rounded-2xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
            Loading…
          </div>
        ) : (
          <div className="grid grid-cols-10 gap-1.5">
            {days.map((d) => {
              const isActive = activeSet.has(d);
              const isToday = d === todayYmd;
              return (
                <div
                  key={d}
                  title={d}
                  className={`size-7 rounded ${
                    isActive ? "bg-emerald-500" : "bg-slate-200"
                  } ${isToday ? "ring-2 ring-blue-500" : ""}`}
                />
              );
            })}
          </div>
        )}
        <div className="mt-5 rounded-2xl bg-slate-50 p-4">
          <p className="text-xs font-bold text-slate-700">How streaks work</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Any activity (attending a class, finishing a quiz, watching a
            video, opening a PDF) counts as a streak day. Miss a day and the
            counter resets.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
