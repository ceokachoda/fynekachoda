"use client";

// Phase 4 Track 4B — exam-regrade dialog. Three modes mirror mobile:
// change_correct / mark_no_correct / mark_all_correct. Calls exam-regrade
// via the mutation hook (full recompute per D-179).

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type RegradeAction = "change_correct" | "mark_no_correct" | "mark_all_correct";

interface RegradeOptionRow {
  id: string;
  text_md: string;
  is_correct: boolean;
  sort_order: number;
}

interface ExamRegradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  examId: string;
  question:
    | { question_id: string; prompt_md: string }
    | null;
  submitting: boolean;
  onSubmit: (input: {
    action: RegradeAction;
    new_correct_option_id?: string;
    reason: string;
  }) => Promise<void>;
}

export function ExamRegradeDialog({
  open,
  onOpenChange,
  examId,
  question,
  submitting,
  onSubmit,
}: ExamRegradeDialogProps) {
  void examId; // referenced by the parent's mutateAsync — keep on the surface.
  const [options, setOptions] = useState<RegradeOptionRow[]>([]);
  const [loadingOpts, setLoadingOpts] = useState(false);
  const [action, setAction] = useState<RegradeAction>("change_correct");
  const [newCorrectId, setNewCorrectId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !question) return;
    let cancelled = false;
    setAction("change_correct");
    setNewCorrectId(null);
    setReason("");
    setError(null);
    setLoadingOpts(true);
    void (async () => {
      const supabase = createSupabaseBrowserClient();
      const res = await supabase
        .from("question_options")
        .select("id, text_md, is_correct, sort_order")
        .eq("question_id", question.question_id)
        .order("sort_order", { ascending: true });
      if (cancelled) return;
      if (res.error || !res.data) {
        setError(res.error?.message ?? "Couldn't load options.");
        setOptions([]);
      } else {
        const rows = res.data as RegradeOptionRow[];
        setOptions(rows);
        const cur = rows.find((o) => o.is_correct);
        setNewCorrectId(cur?.id ?? null);
      }
      setLoadingOpts(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, question]);

  const submit = async () => {
    if (!question) return;
    if (reason.trim().length < 3) {
      setError("Reason must be at least 3 characters.");
      return;
    }
    if (action === "change_correct" && !newCorrectId) {
      setError("Pick the new correct option.");
      return;
    }
    setError(null);
    try {
      await onSubmit({
        action,
        ...(action === "change_correct"
          ? { new_correct_option_id: newCorrectId ?? undefined }
          : {}),
        reason: reason.trim(),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Regrade failed.");
    }
  };

  if (!question) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Regrade question</DialogTitle>
          <p className="line-clamp-3 text-sm text-slate-700">
            {question.prompt_md}
          </p>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-2xl border border-slate-100 bg-white p-3">
            <p className="mb-2 text-xs text-slate-500">Choose action</p>
            {(
              [
                {
                  k: "change_correct",
                  l: "Change correct option",
                  d: "Pick a new correct option. Other options become wrong.",
                },
                {
                  k: "mark_no_correct",
                  l: "Mark no correct",
                  d: "Everyone gets marks_skip for this question.",
                },
                {
                  k: "mark_all_correct",
                  l: "Mark all correct",
                  d: "Everyone gets full marks for this question.",
                },
              ] as const
            ).map((opt) => {
              const sel = action === opt.k;
              return (
                <button
                  key={opt.k}
                  type="button"
                  onClick={() => setAction(opt.k)}
                  className="flex w-full items-start gap-2 py-2 text-left"
                >
                  <span
                    className={cn(
                      "mt-0.5 inline-flex size-5 items-center justify-center rounded-full border-2",
                      sel ? "border-red-600" : "border-slate-300",
                    )}
                  >
                    {sel ? (
                      <span className="size-2.5 rounded-full bg-red-600" />
                    ) : null}
                  </span>
                  <span className="flex-1">
                    <p className="text-sm font-semibold text-slate-900">{opt.l}</p>
                    <p className="text-xs text-slate-500">{opt.d}</p>
                  </span>
                </button>
              );
            })}
          </div>

          {action === "change_correct" ? (
            <div className="rounded-2xl border border-slate-100 bg-white p-3">
              <p className="mb-2 text-xs text-slate-500">Pick new correct</p>
              {loadingOpts ? (
                <p className="text-sm text-slate-500">Loading options…</p>
              ) : (
                <ul className="space-y-1.5">
                  {options.map((o) => {
                    const sel = newCorrectId === o.id;
                    return (
                      <li key={o.id}>
                        <button
                          type="button"
                          onClick={() => setNewCorrectId(o.id)}
                          className="flex w-full items-start gap-2 py-1.5 text-left"
                        >
                          <span
                            className={cn(
                              "mt-0.5 inline-flex size-5 items-center justify-center rounded-full border-2",
                              sel ? "border-primary" : "border-slate-300",
                            )}
                          >
                            {sel ? (
                              <span className="size-2.5 rounded-full bg-primary" />
                            ) : null}
                          </span>
                          <span className="line-clamp-2 flex-1 text-sm text-slate-900">
                            {o.text_md}
                          </span>
                          {o.is_correct ? (
                            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-600">
                              PREV
                            </span>
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ) : null}

          <div className="rounded-2xl border border-slate-100 bg-white p-3">
            <p className="mb-1 text-xs text-slate-500">Reason (audit log)</p>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Why are you regrading this question?"
              className="block min-h-20 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900"
            />
          </div>

          <div className="flex items-start gap-2 rounded-xl border border-yellow-300 bg-yellow-50 p-3">
            <AlertTriangle className="mt-0.5 size-3.5 text-yellow-700" />
            <p className="text-xs text-yellow-900">
              Recomputes every submitted attempt&apos;s score. Original key + per-attempt scores are saved to audit_log.
            </p>
          </div>

          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button
            variant="destructive"
            disabled={submitting}
            onClick={submit}
          >
            {submitting ? (
              <Loader2 className="mr-1 size-3 animate-spin" />
            ) : (
              <CheckCircle2 className="mr-1 size-3" />
            )}
            Apply regrade
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
