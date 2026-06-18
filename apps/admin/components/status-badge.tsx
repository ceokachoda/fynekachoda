"use client";

import React from "react";
import { cn } from "@/lib/utils";

export type BadgeVariant = "success" | "warning" | "destructive" | "default" | "secondary";

interface StatusBadgeProps {
  status: string;
  variant?: BadgeVariant;
  className?: string;
}

export function StatusBadge({ status, variant, className }: StatusBadgeProps) {
  // Auto-detect variant if not provided
  let activeVariant: BadgeVariant = variant || "default";
  
  if (!variant) {
    const s = status.toLowerCase();
    if (s === "active" || s === "present" || s === "published" || s === "live" || s === "released") {
      activeVariant = "success";
    } else if (s === "pending" || s === "late" || s === "draft" || s === "scheduled") {
      activeVariant = "warning";
    } else if (s === "suspended" || s === "absent" || s === "closed" || s === "archived") {
      activeVariant = "destructive";
    }
  }

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
        {
          "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-400": activeVariant === "success",
          "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-400": activeVariant === "warning",
          "bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-400": activeVariant === "destructive",
          "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300": activeVariant === "default",
          "bg-primary/10 text-primary": activeVariant === "secondary",
        },
        className
      )}
    >
      {status}
    </span>
  );
}
