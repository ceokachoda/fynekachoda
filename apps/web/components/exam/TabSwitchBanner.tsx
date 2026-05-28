"use client";

import { ShieldAlert } from "lucide-react";

interface Props {
  count: number;
}

// Yellow on 1–2 switches, red on 3+. Count is sourced from the server
// response so multiple tabs viewing the same attempt stay in agreement.
export function TabSwitchBanner({ count }: Props) {
  if (count <= 0) return null;
  const severe = count >= 3;
  return (
    <div
      role="alert"
      data-severity={severe ? "severe" : "warning"}
      className={`mb-3 flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold ${
        severe
          ? "border-red-300 bg-red-50 text-red-800"
          : "border-amber-300 bg-amber-50 text-amber-800"
      }`}
    >
      <ShieldAlert className="size-4" />
      <span>
        You left the exam tab. Switches:{" "}
        <span className="tabular-nums">{count}</span>
        {severe
          ? " · Further switches may be reviewed by your teacher."
          : ""}
      </span>
    </div>
  );
}
