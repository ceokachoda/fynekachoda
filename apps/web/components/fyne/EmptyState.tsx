import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 px-6 py-12 text-center",
        className,
      )}
    >
      {Icon ? (
        <div className="mb-4 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-100">
          <Icon className="size-8 text-slate-400" />
        </div>
      ) : null}
      <h3 className="text-base font-bold text-slate-900">{title}</h3>
      {description ? (
        <p className="mt-1 max-w-md text-sm text-slate-500">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
