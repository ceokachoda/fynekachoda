"use client";

// Phase 4 Track 4B — pick from the question bank, scoped to a single topic.
// Mirrors the mobile bottom-sheet UX with a Sheet + a search input + a
// scrollable list. Multi-select via checkbox-equivalent rows.

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  useQuestionBank,
  type QuestionBankItem,
} from "@/features/teacher/useQuestionBank";

interface QuestionBankSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  topicId: string | null;
  alreadyIncluded?: string[];
  onPicked: (items: Array<{ id: string; prompt_md: string }>) => void;
}

export function QuestionBankSheet({
  open,
  onOpenChange,
  topicId,
  alreadyIncluded = [],
  onPicked,
}: QuestionBankSheetProps) {
  const bank = useQuestionBank({ topic_id: topicId });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (open) {
      setSelected(new Set());
      setQuery("");
    }
  }, [open]);

  const q = query.trim().toLowerCase();
  const filtered = useMemo<QuestionBankItem[]>(() => {
    const all = bank.data ?? [];
    if (q.length === 0) return all;
    return all.filter((r) => r.prompt_md.toLowerCase().includes(q));
  }, [bank.data, q]);

  const submit = () => {
    if (selected.size === 0) return;
    onPicked(
      Array.from(selected).map((sid) => ({
        id: sid,
        prompt_md: (bank.data ?? []).find((r) => r.id === sid)?.prompt_md ?? "",
      })),
    );
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[80svh] gap-2 overflow-hidden">
        <SheetHeader>
          <SheetTitle>Pick from Question Bank</SheetTitle>
        </SheetHeader>
        <div className="px-4">
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5">
            <Search className="size-4 text-slate-400" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search questions…"
              className="h-7 border-0 p-0 focus-visible:ring-0"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-4">
          {bank.isLoading ? (
            <p className="py-8 text-center text-sm text-slate-500">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">
              {q.length > 0
                ? "No questions match your search."
                : "No questions in this topic."}
            </p>
          ) : (
            <ul className="space-y-2">
              {filtered.map((item) => {
                const isPicked = selected.has(item.id);
                const isAlready = alreadyIncluded.includes(item.id);
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      disabled={isAlready}
                      onClick={() =>
                        setSelected((prev) => {
                          const n = new Set(prev);
                          if (n.has(item.id)) n.delete(item.id);
                          else n.add(item.id);
                          return n;
                        })
                      }
                      className={cn(
                        "flex w-full items-start gap-3 rounded-xl border bg-white p-3 text-left transition-colors",
                        isPicked
                          ? "border-primary"
                          : isAlready
                            ? "border-slate-100 opacity-50"
                            : "border-slate-200 hover:border-slate-300",
                      )}
                    >
                      <div
                        className={cn(
                          "mt-0.5 size-5 shrink-0 rounded-md border",
                          isPicked
                            ? "border-primary bg-primary"
                            : "border-slate-300 bg-white",
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <p
                          className="line-clamp-2 text-sm text-slate-900"
                          data-testid="bank-prompt"
                        >
                          {item.prompt_md}
                        </p>
                        <p className="mt-1 text-[11px] text-slate-500">
                          {item.option_count} options
                          {item.difficulty ? ` · ${item.difficulty}` : ""}
                          {isAlready ? " · already in builder" : ""}
                        </p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <SheetFooter>
          <SheetClose asChild>
            <Button variant="outline">Cancel</Button>
          </SheetClose>
          <Button onClick={submit} disabled={selected.size === 0}>
            Add ({selected.size})
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
