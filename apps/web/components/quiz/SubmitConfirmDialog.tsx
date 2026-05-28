"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  answeredCount: number;
  total: number;
  flaggedCount: number;
  unansweredIndices: number[];
  isSubmitting: boolean;
  variant?: "quiz" | "exam";
  onConfirm: () => void;
}

export function SubmitConfirmDialog({
  open,
  onOpenChange,
  answeredCount,
  total,
  flaggedCount,
  unansweredIndices,
  isSubmitting,
  variant = "quiz",
  onConfirm,
}: Props) {
  const isExam = variant === "exam";
  const title = isExam ? "Submit exam?" : "Submit quiz?";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            You&apos;ve answered{" "}
            <strong className="text-slate-900">
              {answeredCount}/{total}
            </strong>
            {flaggedCount > 0 ? (
              <>
                , flagged <strong>{flaggedCount}</strong>
              </>
            ) : null}
            {isExam ? ". This cannot be undone." : "."}
          </DialogDescription>
        </DialogHeader>
        {unansweredIndices.length > 0 ? (
          <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
            <p className="mb-1 font-bold">
              {unansweredIndices.length} unanswered question
              {unansweredIndices.length === 1 ? "" : "s"}:
            </p>
            <p
              className="font-semibold tabular-nums"
              data-testid="unanswered-list"
            >
              {unansweredIndices.map((i) => `Q${i + 1}`).join(", ")}
            </p>
          </div>
        ) : null}
        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="bg-emerald-600 text-white hover:bg-emerald-700"
            onClick={onConfirm}
            disabled={isSubmitting}
            data-testid="confirm-submit"
          >
            {isSubmitting ? "Submitting…" : "Submit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
