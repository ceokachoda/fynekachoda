"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";

const STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "suspended", label: "Suspended" },
  { value: "must_change", label: "Pending PW change" },
] as const;

export function StudentsFilters({
  initialQ,
  initialStatus,
}: {
  initialQ: string;
  initialStatus: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(initialQ);
  const [pending, startTransition] = useTransition();

  function apply(updates: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v === null || v === "" || v === "all") next.delete(k);
      else next.set(k, v);
    }
    const qs = next.toString();
    startTransition(() => {
      router.push(qs ? `/students?${qs}` : "/students");
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          apply({ q });
        }}
        className="flex-1 min-w-[240px] max-w-md"
      >
        <Input
          type="search"
          placeholder="Search by name or email…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search students"
        />
      </form>
      <div
        role="tablist"
        aria-label="Status filter"
        className="inline-flex rounded-md border border-border bg-background p-0.5"
      >
        {STATUS_OPTIONS.map((opt) => {
          const active = opt.value === initialStatus;
          return (
            <button
              key={opt.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => apply({ status: opt.value })}
              disabled={pending}
              className={
                active
                  ? "rounded px-3 py-1 text-xs font-medium bg-foreground text-background"
                  : "rounded px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-muted"
              }
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
