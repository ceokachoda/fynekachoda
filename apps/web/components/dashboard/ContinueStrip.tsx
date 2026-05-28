"use client";

import Link from "next/link";
import { PlayCircle, FileText } from "lucide-react";
import type { ContinueItem } from "@/features/dashboard/types";

export function ContinueStrip({ items }: { items: ContinueItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
      {items.map((c) => {
        const pct = Math.min(100, Math.max(0, Math.round(c.watched_pct)));
        const href = c.kind === "pdf" ? `/pdf/${c.content_id}` : `/video/${c.content_id}`;
        const Icon = c.kind === "pdf" ? FileText : PlayCircle;
        return (
          <Link
            key={c.content_id}
            href={href}
            className="flex w-56 shrink-0 flex-col rounded-2xl border border-slate-100 bg-white p-4 transition hover:border-slate-200"
          >
            <div className="mb-3 flex items-center gap-2">
              <div className="flex size-10 items-center justify-center rounded-2xl bg-blue-50">
                <Icon className="size-5 text-primary" />
              </div>
              <p className="line-clamp-2 flex-1 text-sm font-bold text-slate-900">
                {c.title}
              </p>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="mt-1.5 text-[11px] text-slate-500">
              {pct}% {c.kind === "pdf" ? "read" : "watched"}
            </p>
          </Link>
        );
      })}
    </div>
  );
}
