"use client";

// Phase 4 Track 4B — correction dialog for the roster screen. Picks a new
// status + preset reason and calls attendance-correct via the mutation hook.

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type {
  AttendanceStatus,
  RosterStudent,
} from "@/features/teacher/useRoster";

const REASON_PRESETS = [
  "Late entry confirmed",
  "QR scan failed",
  "Teacher error",
  "Other",
] as const;

interface CorrectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target:
    | {
        student: RosterStudent;
        preselectStatus: AttendanceStatus | null;
      }
    | null;
  onSubmit: (input: {
    attendance_id: string;
    new_status: AttendanceStatus;
    reason: string;
  }) => Promise<void> | void;
  submitting?: boolean;
  error?: string | null;
}

export function CorrectionDialog({
  open,
  onOpenChange,
  target,
  onSubmit,
  submitting,
  error,
}: CorrectionDialogProps) {
  const [status, setStatus] = useState<AttendanceStatus | null>(null);
  const [reason, setReason] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (open && target) {
      setStatus(target.preselectStatus ?? null);
      setReason("");
      setLocalError(null);
    }
  }, [open, target]);

  const handleSubmit = useCallback(async () => {
    if (!target?.student.attendance_id) {
      setLocalError("This student isn't marked yet.");
      return;
    }
    if (!status) {
      setLocalError("Pick a new status.");
      return;
    }
    if (status === target.student.status) {
      setLocalError("New status must differ from the current one.");
      return;
    }
    if (reason.trim().length < 3) {
      setLocalError("Add a short reason (3+ characters).");
      return;
    }
    setLocalError(null);
    await onSubmit({
      attendance_id: target.student.attendance_id,
      new_status: status,
      reason: reason.trim(),
    });
  }, [target, status, reason, onSubmit]);

  if (!target) return null;
  const current = target.student.status ?? "unmarked";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Change status — {target.student.full_name}</DialogTitle>
          <p className="text-xs text-slate-500">Current: {current}</p>
        </DialogHeader>
        <div>
          <p className="mb-2 text-[11px] font-bold uppercase text-slate-500">
            New status
          </p>
          <div className="mb-4 grid grid-cols-3 gap-2">
            {(["present", "late", "absent"] as const).map((s) => {
              const active = status === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={cn(
                    "rounded-2xl border px-3 py-3 text-xs font-bold uppercase transition-colors",
                    active
                      ? s === "present"
                        ? "border-emerald-600 bg-emerald-600 text-white"
                        : s === "late"
                          ? "border-amber-500 bg-amber-500 text-white"
                          : "border-red-600 bg-red-600 text-white"
                      : "border-slate-200 bg-white text-slate-700",
                  )}
                >
                  {s}
                </button>
              );
            })}
          </div>
          <p className="mb-2 text-[11px] font-bold uppercase text-slate-500">
            Reason
          </p>
          <div className="mb-3 flex flex-wrap gap-2">
            {REASON_PRESETS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReason(r)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors",
                  reason === r
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-slate-200 bg-white text-slate-700",
                )}
              >
                {r}
              </button>
            ))}
          </div>
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Type a reason"
            maxLength={500}
          />
          {localError || error ? (
            <p className="mt-3 text-xs text-destructive">
              {localError ?? error}
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? (
              <Loader2 className="mr-1 size-3 animate-spin" />
            ) : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
