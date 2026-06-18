"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  children?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  children,
  className,
}: EmptyStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex min-h-[400px] w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-card/50 p-8 text-center animate-in fade-in zoom-in-95 duration-500",
        className
      )}
    >
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted/80 ring-8 ring-muted/20 mb-6 transition-all duration-500 hover:scale-110">
        <Icon className="h-10 w-10 text-muted-foreground/70" aria-hidden="true" />
      </div>
      <h3 className="text-xl font-bold tracking-tight text-foreground">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground max-w-sm leading-relaxed">{description}</p>
      {children && <div className="mt-8 flex items-center justify-center gap-3">{children}</div>}
    </div>
  );
}
