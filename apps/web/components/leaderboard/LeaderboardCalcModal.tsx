"use client";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

interface WeightProps {
  pct: string;
  color: string;
  title: string;
  body: string;
}

function Weight({ pct, color, title, body }: WeightProps) {
  return (
    <div className="mb-4 flex items-start">
      <div
        className="mr-3 flex size-14 shrink-0 items-center justify-center rounded-2xl"
        style={{ backgroundColor: `${color}1a` }}
      >
        <span className="text-base font-extrabold" style={{ color }}>
          {pct}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-slate-900">{title}</p>
        <p className="mt-0.5 text-xs leading-5 text-slate-500">{body}</p>
      </div>
    </div>
  );
}

export function LeaderboardCalcModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-[28px] p-6">
        <DialogTitle className="mb-2 text-xl font-extrabold text-blue-900">
          How rank is calculated
        </DialogTitle>
        <p className="mb-5 text-xs leading-5 text-slate-500">
          Your composite score blends three things, each scored from 0 to 1.
        </p>
        <Weight
          pct="60%"
          color="#2563eb"
          title="Quiz &amp; exam scores"
          body="Your average score across quizzes and exams in the period."
        />
        <Weight
          pct="25%"
          color="#10b981"
          title="Activity"
          body="How many days you were active out of the days you could be."
        />
        <Weight
          pct="15%"
          color="#f97316"
          title="Streak"
          body="Your current daily streak — full credit at a 30-day streak."
        />
      </DialogContent>
    </Dialog>
  );
}
