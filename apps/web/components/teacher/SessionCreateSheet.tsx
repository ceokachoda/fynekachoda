"use client";

// Phase 4 Track 4B — combined Schedule-Live / Ad-hoc bottom sheet. Wraps
// session-create-ad-hoc; the parent decides which mode based on the FAB
// pressed. Teachers name the class and pick a date + start time (so an offline
// class can be scheduled ahead, not just "now"). Default batch picks the
// teacher's first assigned batch (Phase-10 carry-over).

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CalendarPlus,
  Check,
  ChevronDown,
  Clock,
  Radio,
} from "lucide-react";
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

function formatTimeIst(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateIst(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

const LABEL_CLASS = "mb-2 block text-sm font-semibold text-slate-700";
const FIELD_CLASS =
  "h-12 rounded-xl border-slate-200 bg-white text-base shadow-sm";

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

  // One accent palette per mode keeps the live (red) and offline (blue) flows
  // visually distinct without duplicating className strings everywhere.
  const accent = isLive
    ? {
        badge: "bg-red-50 text-red-600 ring-1 ring-red-100",
        chipOn: "border-red-600 bg-red-600 text-white shadow-sm",
        card: "border-red-100 bg-red-50/70",
        cardLabel: "text-red-700/80",
        cta: "bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600/30",
      }
    : {
        badge: "bg-blue-50 text-primary ring-1 ring-blue-100",
        chipOn: "border-primary bg-primary text-white shadow-sm",
        card: "border-blue-100 bg-blue-50/70",
        cardLabel: "text-primary/80",
        cta: "bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-primary/30",
      };

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
      <SheetContent
        side="bottom"
        className="max-h-[92svh] overflow-y-auto rounded-t-3xl p-0"
      >
        <div className="mx-auto w-full max-w-xl px-5 pt-6 pb-2 sm:px-6">
          <SheetHeader className="p-0">
            <div className="flex items-start gap-3 pr-8">
              <span
                className={cn(
                  "flex size-11 shrink-0 items-center justify-center rounded-2xl",
                  accent.badge,
                )}
                aria-hidden
              >
                {isLive ? (
                  <Radio className="size-5" />
                ) : (
                  <CalendarPlus className="size-5" />
                )}
              </span>
              <div className="min-w-0">
                <SheetTitle className="text-lg font-bold text-slate-900">
                  {isLive ? "Schedule live class" : "New offline class"}
                </SheetTitle>
                <SheetDescription className="mt-0.5 text-sm text-slate-500">
                  {isLive
                    ? "Streams over YouTube. You'll get your OBS stream key on the next screen."
                    : "One-off session in one of your assigned batches — take attendance by QR or mark students manually."}
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <div className="mt-6 space-y-5">
            <div>
              <label htmlFor="class-name" className={LABEL_CLASS}>
                Class name
              </label>
              <Input
                id="class-name"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={TITLE_MAX}
                placeholder={
                  isLive
                    ? "e.g. Physics — Live doubt class"
                    : "e.g. Chemistry — Mole concept revision"
                }
                autoComplete="off"
                className={FIELD_CLASS}
              />
            </div>

            <div>
              <p className={LABEL_CLASS}>Batch</p>
              <button
                type="button"
                onClick={() => setShowBatchPicker((v) => !v)}
                aria-haspopup="listbox"
                aria-expanded={showBatchPicker}
                className={cn(
                  "flex h-12 w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 text-left shadow-sm transition-colors hover:border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                )}
              >
                <span className="truncate text-base font-semibold text-slate-900">
                  {selectedBatch
                    ? `${selectedBatch.course_code} · ${selectedBatch.batch_name}`
                    : "Select a batch"}
                </span>
                <ChevronDown
                  className={cn(
                    "size-4 shrink-0 text-slate-400 transition-transform",
                    showBatchPicker && "rotate-180",
                  )}
                />
              </button>
              {showBatchPicker ? (
                <ul
                  role="listbox"
                  className="mt-2 max-h-52 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg"
                >
                  {batches.map((b) => {
                    const isSel = b.batch_id === selectedBatchId;
                    return (
                      <li key={b.batch_id}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={isSel}
                          onClick={() => {
                            setPickedBatchId(b.batch_id);
                            setShowBatchPicker(false);
                          }}
                          className="flex w-full items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 text-left last:border-b-0 hover:bg-slate-50"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold text-slate-900">
                              {b.batch_name}
                            </span>
                            <span className="block truncate text-xs text-slate-500">
                              {b.course_code} · {b.course_name}
                            </span>
                          </span>
                          {isSel ? (
                            <Check className="size-4 shrink-0 text-primary" />
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="class-date" className={LABEL_CLASS}>
                  Date
                </label>
                <Input
                  id="class-date"
                  type="date"
                  value={date}
                  min={istTodayYmd()}
                  onChange={(e) => setDate(e.target.value)}
                  className={FIELD_CLASS}
                />
              </div>
              <div>
                <label htmlFor="class-time" className={LABEL_CLASS}>
                  Start time
                </label>
                <Input
                  id="class-time"
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className={FIELD_CLASS}
                />
              </div>
            </div>

            <div>
              <p className={LABEL_CLASS}>Duration</p>
              <div className="grid grid-cols-4 gap-2">
                {DURATION_OPTIONS_MIN.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDurationMin(d)}
                    aria-pressed={d === durationMin}
                    className={cn(
                      "h-11 rounded-xl border text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                      d === durationMin
                        ? accent.chipOn
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300",
                    )}
                  >
                    {d} min
                  </button>
                ))}
              </div>
            </div>

            <div className={cn("rounded-2xl border p-4", accent.card)}>
              <p
                className={cn(
                  "flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide",
                  accent.cardLabel,
                )}
              >
                <Clock className="size-3.5" />
                Class window
              </p>
              {range ? (
                <>
                  <p className="mt-1.5 text-xl font-extrabold tracking-tight text-slate-900 tabular-nums">
                    {formatTimeIst(range.startIso)}
                    <span className="mx-1.5 font-medium text-slate-400">—</span>
                    {formatTimeIst(range.endIso)}
                  </p>
                  <p className="mt-0.5 text-sm font-medium text-slate-600">
                    {formatDateIst(range.startIso)} · {durationMin} min · IST
                  </p>
                </>
              ) : (
                <p className="mt-1.5 text-base font-semibold text-slate-500">
                  Pick a date and start time
                </p>
              )}
              <p className="mt-2 text-xs text-slate-500">
                {isLive
                  ? "You control when students can join. QR + manual attendance open 15 min before start."
                  : "Students can be scanned (or marked manually) from 15 min before start."}
              </p>
            </div>

            {error ? (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 px-3.5 py-3 text-sm font-medium text-destructive"
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <span>{error}</span>
              </div>
            ) : null}
          </div>

          <SheetFooter className="mt-6 flex-col gap-2.5 p-0 pb-2 sm:flex-row sm:gap-3">
            <SheetClose asChild>
              <Button
                variant="outline"
                className="h-12 rounded-xl text-base font-semibold sm:flex-1"
              >
                Cancel
              </Button>
            </SheetClose>
            <Button
              onClick={submit}
              disabled={create.isPending || !title.trim() || !range}
              className={cn(
                "h-12 rounded-xl text-base font-semibold sm:flex-1",
                accent.cta,
              )}
            >
              {create.isPending
                ? "Creating…"
                : isLive
                  ? "Set up live class"
                  : "Create class"}
            </Button>
          </SheetFooter>
        </div>
      </SheetContent>
    </Sheet>
  );
}
