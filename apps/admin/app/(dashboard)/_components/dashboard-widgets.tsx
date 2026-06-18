import Link from "next/link";
import { ArrowRight, Activity, FileText, CheckCircle2, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function QuickActionButton({
  label,
  href,
  icon: Icon,
  description,
  colorClass,
}: {
  label: string;
  href: string;
  icon: LucideIcon;
  description: string;
  colorClass: string;
}) {
  return (
    <Link href={href} className="group block h-full">
      <Card className="h-full hover-lift p-5 border-border bg-card flex flex-col justify-between items-start gap-4 transition-all">
        <div className={cn("p-2.5 rounded-xl text-white shadow-sm", colorClass)}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground flex items-center gap-1.5 group-hover:text-primary transition-colors">
            {label}
            <ArrowRight className="w-3.5 h-3.5 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" />
          </h3>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{description}</p>
        </div>
      </Card>
    </Link>
  );
}

export function MetricCard({
  label,
  value,
  href,
  hint,
  icon: Icon,
  accent,
  isSecondary = false,
}: {
  label: string;
  value: number;
  href: string;
  hint: string;
  icon: LucideIcon;
  accent: string;
  isSecondary?: boolean;
}) {
  return (
    <Link href={href} className="block group">
      <Card className="hover-lift p-5 h-full flex flex-col justify-between border-border relative overflow-hidden bg-card transition-all">
        {/* Subtle background glow effect on hover */}
        <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full opacity-0 group-hover:opacity-10 blur-2xl transition-opacity duration-500 bg-current" style={{ color: "var(--foreground)" }} />
        
        <div className="flex justify-between items-start gap-2 mb-4 relative z-10">
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
              {label}
            </p>
            <p className={cn("font-semibold tabular-nums tracking-tight", isSecondary ? "text-2xl" : "text-4xl", accent)}>
              {value.toLocaleString()}
            </p>
          </div>
          <div className={cn("p-2 rounded-lg bg-muted text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary")}>
            <Icon className="w-4 h-4" />
          </div>
        </div>
        <p className="text-xs text-muted-foreground/80 font-medium relative z-10 flex items-center gap-1.5">
          {hint}
        </p>
      </Card>
    </Link>
  );
}

export function ActivityFeedItem({
  actionLabel,
  actionRaw,
  entity,
  actorRole,
  time,
}: {
  actionLabel: string;
  actionRaw: string;
  entity: string;
  actorRole: string;
  time: string;
}) {
  const isCreation = actionRaw.includes("create");
  const isSuspension = actionRaw.includes("suspend") || actionRaw.includes("force");
  
  const iconColor = isCreation ? "text-chart-2 bg-chart-2/10" : isSuspension ? "text-destructive bg-destructive/10" : "text-primary bg-primary/10";

  return (
    <div className="flex gap-4 relative py-4 group">
      {/* Timeline track */}
      <div className="absolute left-4 top-10 bottom-[-1rem] w-px bg-border group-last:hidden" />
      
      <div className={cn("relative z-10 shrink-0 w-8 h-8 rounded-full flex items-center justify-center ring-4 ring-card", iconColor)}>
        {isCreation ? <CheckCircle2 className="w-4 h-4" /> : isSuspension ? <Activity className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
      </div>
      
      <div className="flex-1 min-w-0 pt-1.5">
        <p className="text-sm text-foreground leading-tight">
          <span className="font-semibold capitalize text-foreground/90">
            {actorRole ? actorRole.replace("_", " ") : "System"}
          </span>{" "}
          <span className="text-muted-foreground">
            {actionLabel}
          </span>
        </p>
        <div className="flex items-center gap-2 mt-1">
          <span className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
            {entity.replace("_", " ")}
          </span>
          <span className="text-xs text-muted-foreground/60 tabular-nums">
            {time}
          </span>
        </div>
      </div>
    </div>
  );
}
