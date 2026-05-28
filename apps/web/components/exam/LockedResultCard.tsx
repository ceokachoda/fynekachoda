"use client";

import { Lock, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  submittedAt?: string | null;
  tabSwitchCount?: number;
  onRefresh: () => void;
  refreshing?: boolean;
}

// Shown when exam-attempt-result returns 423 (manual release, teacher
// hasn't released yet). The hook auto-refetches on window focus; this
// card surfaces a manual Refresh affordance too.
export function LockedResultCard({
  submittedAt,
  tabSwitchCount,
  onRefresh,
  refreshing,
}: Props) {
  return (
    <div
      className="rounded-2xl border border-slate-200 bg-white p-6 text-center"
      data-testid="locked-result"
    >
      <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-slate-100">
        <Lock className="size-5 text-slate-600" />
      </div>
      <h2 className="text-lg font-extrabold text-slate-900">
        Results will be available after your teacher releases them
      </h2>
      <p className="mt-2 text-sm text-slate-600">
        Your answers are submitted and locked. You&apos;ll see your score and
        solutions on this page as soon as the release happens — we&apos;ll
        refresh automatically when you return to this tab.
      </p>
      {submittedAt ? (
        <p className="mt-3 text-xs text-slate-500">
          Submitted: {new Date(submittedAt).toLocaleString("en-IN")}
        </p>
      ) : null}
      {typeof tabSwitchCount === "number" && tabSwitchCount > 0 ? (
        <p className="mt-1 text-xs text-slate-500">
          Tab switches recorded: {tabSwitchCount}
        </p>
      ) : null}
      <Button
        type="button"
        variant="outline"
        onClick={onRefresh}
        disabled={refreshing}
        className="mt-4 inline-flex items-center gap-2"
      >
        <RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
        {refreshing ? "Checking…" : "Refresh now"}
      </Button>
    </div>
  );
}
