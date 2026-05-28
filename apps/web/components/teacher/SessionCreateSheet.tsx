"use client";

// Phase 4 Track 4B — combined Schedule-Live / Ad-hoc bottom sheet. Wraps
// session-create-ad-hoc; the parent decides which mode based on the FAB
// pressed. Default batch picks the teacher's first assigned batch
// (Phase-10 carry-over).

import { useEffect, useMemo, useState } from "react";
import { CalendarPlus, ChevronDown, Radio } from "lucide-react";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCreateAdHocSession } from "@/features/teacher/mutations";
import type { AssignedBatch } from "@/features/teacher/useAssignedBatches";

interface SessionCreateSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "live" | "adhoc";
  batches: AssignedBatch[];
  onCreated: (sessionId: string) => void;
}

const DURATION_OPTIONS_MIN = [30, 45, 60, 90] as const;

function nextRoundedQuarter(): Date {
  const fifteenMin = 15 * 60 * 1000;
  return new Date(Math.ceil(Date.now() / fifteenMin) * fifteenMin);
}

function formatTimeIst(d: Date): string {
  return d.toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SessionCreateSheet({
  open,
  onOpenChange,
  mode,
  batches,
  onCreated,
}: SessionCreateSheetProps) {
  const create = useCreateAdHocSession();
  const [pickedBatchId, setPickedBatchId] = useState<string | null>(null);
  const [durationMin, setDurationMin] = useState<number>(60);
  const [showBatchPicker, setShowBatchPicker] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Recompute the start time each time the sheet opens so the "next 15-min
  // mark" is current; `open` is intentional in the dep array.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const start = useMemo(() => nextRoundedQuarter(), [open]);
  const end = useMemo(
    () => new Date(start.getTime() + durationMin * 60 * 1000),
    [start, durationMin],
  );

  // Fall back to the first batch so the teacher always has a default selected.
  const selectedBatchId = pickedBatchId ?? batches[0]?.batch_id ?? null;
  const selectedBatch = batches.find((b) => b.batch_id === selectedBatchId);

  useEffect(() => {
    if (open) {
      setError(null);
      setPickedBatchId(null);
      setShowBatchPicker(false);
    }
  }, [open]);

  const submit = async () => {
    if (!selectedBatchId) {
      setError("Pick a batch first.");
      return;
    }
    setError(null);
    try {
      const res = await create.mutateAsync({
        batch_id: selectedBatchId,
        scheduled_start: start.toISOString(),
        scheduled_end: end.toISOString(),
        is_live_class: mode === "live",
      });
      onCreated(res.session_id);
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't create the session.");
    }
  };

  const isLive = mode === "live";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85svh] overflow-y-auto pb-6">
        <SheetHeader>
          <div className="flex items-center gap-2">
            {isLive ? (
              <Radio className="size-5 text-red-600" />
            ) : (
              <CalendarPlus className="size-5 text-primary" />
            )}
            <SheetTitle>
              {isLive ? "Schedule live class" : "New ad-hoc class"}
            </SheetTitle>
          </div>
          <SheetDescription>
            {isLive
              ? "Streams over YouTube. You'll get your OBS stream key on the next screen."
              : "One-off session in one of your assigned batches."}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 px-4">
          <div>
            <p className="mb-1.5 text-[11px] font-bold uppercase text-slate-500">
              Batch
            </p>
            <button
              type="button"
              onClick={() => setShowBatchPicker((v) => !v)}
              className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
            >
              <span className="truncate text-sm font-semibold text-slate-900">
                {selectedBatch
                  ? `${selectedBatch.course_code} · ${selectedBatch.batch_name}`
                  : "Select a batch"}
              </span>
              <ChevronDown className="size-4 text-slate-500" />
            </button>
            {showBatchPicker ? (
              <div className="mt-2 max-h-44 overflow-y-auto rounded-2xl border border-slate-100 bg-white">
                {batches.map((b) => (
                  <button
                    key={b.batch_id}
                    type="button"
                    onClick={() => {
                      setPickedBatchId(b.batch_id);
                      setShowBatchPicker(false);
                    }}
                    className="block w-full border-b border-slate-50 px-4 py-3 text-left last:border-b-0 hover:bg-muted/50"
                  >
                    <p className="text-sm font-semibold text-slate-900">
                      {b.batch_name}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {b.course_code} · {b.course_name}
                    </p>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div>
            <p className="mb-1.5 text-[11px] font-bold uppercase text-slate-500">
              Duration
            </p>
            <div className="flex flex-wrap gap-2">
              {DURATION_OPTIONS_MIN.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDurationMin(d)}
                  className={cn(
                    "rounded-full border px-3 py-2 text-xs font-semibold transition-colors",
                    d === durationMin
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-slate-200 bg-white text-slate-700",
                  )}
                >
                  {d} min
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-[11px] font-bold uppercase text-slate-500">Starts</p>
            <p className="mt-0.5 text-sm font-bold text-slate-900">
              {formatTimeIst(start)} — {formatTimeIst(end)} (IST)
            </p>
            <p className="mt-1 text-[11px] text-slate-400">
              Starts at the next 15-minute mark.{" "}
              {isLive ? "You control when students can join." : "Adjust duration above."}
            </p>
          </div>

          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </div>

        <SheetFooter>
          <SheetClose asChild>
            <Button variant="outline">Cancel</Button>
          </SheetClose>
          <Button
            onClick={submit}
            disabled={create.isPending}
            variant={isLive ? "destructive" : "default"}
          >
            {create.isPending
              ? "Creating…"
              : isLive
                ? "Set up live class"
                : "Create class"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
