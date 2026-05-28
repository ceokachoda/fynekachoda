"use client";

// Phase 4 Track 4B — one student row in the roster screen with P/L/A pills.
// Tap the active pill → unmark (mobile D-164); tap a different pill → either
// manual-mark (if unmarked) or correction (if marked).

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  AttendanceStatus,
  RosterStudent,
} from "@/features/teacher/useRoster";

interface RosterRowProps {
  student: RosterStudent;
  onPillTap: (status: AttendanceStatus) => void;
  onOpenCorrection: () => void;
  busy?: boolean;
}

const PILL_STYLES: Record<AttendanceStatus, { active: string; idle: string; label: string }> = {
  present: {
    active: "bg-emerald-600 text-white border-emerald-600",
    idle: "bg-emerald-50 text-emerald-700 border-emerald-100",
    label: "P",
  },
  late: {
    active: "bg-amber-500 text-white border-amber-500",
    idle: "bg-amber-50 text-amber-700 border-amber-100",
    label: "L",
  },
  absent: {
    active: "bg-red-600 text-white border-red-600",
    idle: "bg-red-50 text-red-700 border-red-100",
    label: "A",
  },
};

export function RosterRow({
  student,
  onPillTap,
  onOpenCorrection,
  busy,
}: RosterRowProps) {
  return (
    <div
      className={cn(
        "flex items-center rounded-2xl border border-slate-100 bg-white p-3 transition-opacity",
        busy && "opacity-60",
      )}
      data-testid={`roster-row-${student.user_id}`}
    >
      <div className="mr-3 flex size-9 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-primary">
        {student.full_name.slice(0, 1).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-900">
          {student.full_name}
        </p>
        {student.method ? (
          <p className="text-[11px] text-slate-400">
            via {student.method}
            {student.marked_at
              ? ` · ${new Date(student.marked_at).toLocaleTimeString("en-IN", {
                  timeZone: "Asia/Kolkata",
                  hour: "2-digit",
                  minute: "2-digit",
                })}`
              : ""}
          </p>
        ) : null}
      </div>
      {busy ? (
        <Loader2 className="mr-2 size-4 animate-spin text-slate-400" />
      ) : null}
      <div className="flex items-center gap-1">
        {(["present", "late", "absent"] as const).map((s) => {
          const active = student.status === s;
          const style = PILL_STYLES[s];
          return (
            <button
              key={s}
              type="button"
              disabled={busy}
              onClick={() => onPillTap(s)}
              aria-pressed={active}
              aria-label={`Mark ${s}`}
              className={cn(
                "h-8 w-9 rounded-lg border text-xs font-bold transition-colors",
                active ? style.active : style.idle,
              )}
              data-testid={`roster-pill-${student.user_id}-${s}`}
            >
              {style.label}
            </button>
          );
        })}
        <button
          type="button"
          disabled={busy || !student.attendance_id}
          onClick={onOpenCorrection}
          className="ml-1 rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600 disabled:opacity-30"
          aria-label="Open correction dialog"
        >
          Edit
        </button>
      </div>
    </div>
  );
}
