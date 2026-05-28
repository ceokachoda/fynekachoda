import { ChevronRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ListRowProps {
  icon?: LucideIcon;
  iconBgClassName?: string;
  iconColorClassName?: string;
  label: string;
  subLabel?: string;
  rightSlot?: React.ReactNode;
  onClick?: () => void;
  isLast?: boolean;
  disabled?: boolean;
  className?: string;
}

export function ListRow({
  icon: Icon,
  iconBgClassName = "bg-blue-50",
  iconColorClassName = "text-primary",
  label,
  subLabel,
  rightSlot,
  onClick,
  isLast,
  disabled,
  className,
}: ListRowProps) {
  const Comp: "div" | "button" = onClick ? "button" : "div";
  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex w-full items-center p-4 text-left transition-colors",
        !isLast && "border-b border-slate-100",
        onClick && !disabled && "hover:bg-slate-50",
        disabled && "opacity-50",
        className,
      )}
    >
      {Icon ? (
        <div
          className={cn(
            "mr-4 inline-flex size-12 items-center justify-center rounded-2xl",
            iconBgClassName,
          )}
        >
          <Icon className={cn("size-5", iconColorClassName)} />
        </div>
      ) : null}
      <div className="flex-1">
        <p className="text-base font-bold text-slate-800">{label}</p>
        {subLabel ? (
          <p className="mt-0.5 text-xs font-medium text-slate-500">{subLabel}</p>
        ) : null}
      </div>
      {rightSlot ?? (onClick ? <ChevronRight className="size-5 text-slate-300" /> : null)}
    </Comp>
  );
}
