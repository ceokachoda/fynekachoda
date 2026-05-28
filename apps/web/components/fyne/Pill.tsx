import { cn } from "@/lib/utils";

interface PillProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, "className"> {
  children: React.ReactNode;
  tone?: "primary" | "neutral" | "success" | "warning" | "error";
  className?: string;
}

const toneClasses = {
  primary: "bg-primary/10 text-primary",
  neutral: "bg-slate-100 text-slate-700",
  success: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-700",
  error: "bg-red-50 text-red-700",
} as const;

export function Pill({
  children,
  tone = "neutral",
  className,
  ...rest
}: PillProps) {
  return (
    <span
      {...rest}
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
