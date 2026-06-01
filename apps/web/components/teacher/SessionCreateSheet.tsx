"use client";

// Phase 4 Track 4B — combined Schedule-Live / Ad-hoc bottom sheet. Wraps
// session-create-ad-hoc; the parent decides which mode based on the FAB
// pressed. Teachers name the class and pick a date + start time (so an offline
// class can be scheduled ahead, not just "now"). Default batch picks the
// teacher's first assigned batch (Phase-10 carry-over).

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
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useCreateAdHocSession } from "@/features/teacher/mutations";
import {
  addMinutesToIso,
  defaultScheduleFields,
  istDateTimeToIso,
  istTodayYmd,
} from "@/features/teacher/session-schedule";
import type { AssignedBatch } from "@/features/teacher/useAssignedBatches";

interface SessionCreateSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "live" | "adhoc";
  batches: AssignedBatch[];
  onCreated: (sessionId: string) => void;
}

const DURATION_OPTIONS_MIN = [30, 45, 60, 90] as const;
const TITLE_MAX = 120;

function formatRangeIst(startIso: string, endIso: string): string {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleTimeString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
    });
  return `${fmt(startIso)} — ${fmt(endIso)}`;
}

export function SessionCreateSheet({
  open,
  onOpenChange,
  mode,
  batches,
  onCreated,
}: SessionCreateSheetProps) {
  const create = useCreateAdHocSession();
  const [title, setTitle] = useState("");
  const [pickedBatchId, setPickedBatchId] = useState<string | null>(null);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [durationMin, setDurationMin] = useState<number>(60);
  const [showBatchPicker, setShowBatchPicker] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fall back to the first batch so the teacher always has a default selected.
  const selectedBatchId = pickedBatchId ?? batches[0]?.batch_id ?? null;
  const selectedBatch = batches.find((b) => b.batch_id === selectedBatchId);

  useEffect(() => {
    if (open) {
      const { date: d, time: t } = defaultScheduleFields();
      setTitle("");
      setDate(d);
      setTime(t);
      setDurationMin(60);
      setError(null);
      setPickedBatchId(null);
      setShowBatchPicker(false);
    }
  }, [open]);

  const range = useMemo(() => {
    if (!date || !time) return null;
    try {
      const startIso = istDateTimeToIso(date, time);
      if (Number.isNaN(new Date(startIso).getTime())) return null;
      const endIso = addMinutesToIso(startIso, durationMin);
      return { startIso, endIso };
    } catch {
      return null;
    }
  }, [date, time, durationMin]);

  const isLive = mode === "live";

  const submit = async () => {
    if (!title.trim()) {
      setError("Give the class a name.");
      return;
    }
    if (!selectedBatchId) {
      setError("Pick a batch first.");
      return;
    }
    if (!range) {
      setError("Pick a valid date and start time.");
      return;
    }
    setError(null);
    try {
      const res = await create.mutateAsync({
        batch_id: selectedBatchId,
        title: title.trim(),
        scheduled_start: range.startIso,
        scheduled_end: range.endIso,
        is_live_class: isLive,
      });
      onCreated(res.session_id);
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't create the session.");
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[90svh] overflow-y-auto pb-6">
        <SheetHeader>
          <div className="flex items-center gap-2">
            {isLive ? (
              <Radio className="size-5 text-red-600" />
            ) : (
              <CalendarPlus className="size-5 text-primary" />
            )}
            <SheetTitle>
              {isLive ? "Schedule live class" : "New offline class"}
            </SheetTitle>
          </div>
          <SheetDescription>
            {isLive
              ? "Streams over YouTube. You'll get your OBS stream key on the next screen."
              : "One-off session in one of your assigned batches — take attendance by QR or mark students manually."}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 px-4">
          <div>
            <label
              htmlFor="class-name"
              className="mb-1.5 block text-[11px] font-bold uppercase text-slate-500"
            >
              Class name
            </label>
            <Input
              id="class-name"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={TITLE_MAX}
              placeholder={
                isLive ? "e.g. Physics — Live doubt class" : "e.g. Chemistry — Mole concept revision"
              }
              autoComplete="off"
            />
          </div>

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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="class-date"
                className="mb-1.5 block text-[11px] font-bold uppercase text-slate-500"
              >
                Date
              </label>
              <Input
                id="class-date"
                type="date"
                value={date}
                min={istTodayYmd()}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div>
              <label
                htmlFor="class-time"
                className="mb-1.5 block text-[11px] font-bold uppercase text-slate-500"
              >
                Start time
              </label>
              <Input
                id="class-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
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
            <p className="text-[11px] font-bold uppercase text-slate-500">Class window</p>
            <p className="mt-0.5 text-sm font-bold text-slate-900">
              {range ? `${formatRangeIst(range.startIso, range.endIso)} (IST)` : "Pick a date and time"}
            </p>
            <p className="mt-1 text-[11px] text-slate-400">
              {isLive
                ? "You control when students can join. QR + manual attendance open 15 min before start."
                : "Students can be scanned (or marked manually) from 15 min before start."}
            </p>
          </div>

          {error ? <p className="text-xs text-destructive" role="alert">{error}</p> : null}
        </div>

        <SheetFooter>
          <SheetClose asChild>
            <Button variant="outline">Cancel</Button>
          </SheetClose>
          <Button
            onClick={submit}
            disabled={create.isPending || !title.trim() || !range}
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
