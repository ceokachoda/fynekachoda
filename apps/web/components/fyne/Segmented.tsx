"use client";

import { cn } from "@/lib/utils";

interface SegmentOption<V extends string> {
  value: V;
  label: string;
}

interface SegmentedProps<V extends string> {
  value: V;
  onChange: (next: V) => void;
  options: ReadonlyArray<SegmentOption<V>>;
  className?: string;
  ariaLabel?: string;
}

// Mirrors the mobile segmented control: bg-slate-200/70 p-1.5 rounded-2xl,
// active tab = white bg + text-blue-600.
export function Segmented<V extends string>({
  value,
  onChange,
  options,
  className,
  ariaLabel,
}: SegmentedProps<V>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex w-full items-stretch gap-1 rounded-2xl bg-slate-100 p-1.5",
        className,
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              "flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition-colors",
              active
                ? "bg-white text-primary shadow-sm"
                : "text-slate-600 hover:text-slate-800",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
