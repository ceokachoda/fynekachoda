"use client";

import { useState } from "react";
import { Award } from "lucide-react";
import { BadgeIcon } from "./BadgeIcon";
import { formatIstDay } from "@/lib/ist";
import type { BadgeCollectionItem } from "@/features/gamification/useBadgesCollection";

export function BadgeShowcase({ items }: { items: BadgeCollectionItem[] }) {
  const [selected, setSelected] = useState<BadgeCollectionItem | null>(null);
  if (items.length === 0) {
    return (
      <div className="rounded-2xl bg-slate-50 p-6 text-center">
        <Award className="mx-auto mb-2 size-8 text-slate-400" />
        <p className="text-sm text-slate-500">
          Earn badges by attending, hitting streaks, topping quizzes.
        </p>
      </div>
    );
  }
  return (
    <div>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {items.map((b) => (
          <button
            key={b.code}
            type="button"
            onClick={() => setSelected(b)}
            aria-label={`${b.name}, ${b.earned ? "earned" : "locked"}`}
            className="flex flex-col items-center rounded-2xl p-2 transition hover:bg-slate-50"
          >
            <BadgeIcon uri={b.iconUrl} size={72} locked={!b.earned} />
            <p
              className={`mt-1.5 line-clamp-2 px-1 text-center text-[11px] font-bold ${
                b.earned ? "text-slate-800" : "text-slate-400"
              }`}
            >
              {b.name}
            </p>
          </button>
        ))}
      </div>
      {selected ? (
        <div className="mt-4 rounded-2xl border border-slate-100 bg-white p-4">
          <div className="flex items-center gap-3">
            <BadgeIcon uri={selected.iconUrl} size={48} locked={!selected.earned} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-slate-900">{selected.name}</p>
              <p className="text-xs text-slate-500">
                {selected.earned && selected.earned_at
                  ? `Earned ${formatIstDay(selected.earned_at)}`
                  : selected.description}
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
