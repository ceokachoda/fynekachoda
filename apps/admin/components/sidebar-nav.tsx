"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  CalendarCheck,
  ClipboardCheck,
  FileText,
  FileQuestionMark,
  FolderOpen,
  GraduationCap,
  Layers,
  LayoutDashboard,
  ListChecks,
  ScrollText,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

export interface SidebarItem {
  label: string;
  href: string;
  comingPhase?: string;
}

const ICONS: Record<string, LucideIcon> = {
  "/": LayoutDashboard,
  "/students": Users,
  "/teachers": GraduationCap,
  "/admins": ShieldCheck,
  "/batches": Layers,
  "/courses": BookOpen,
  "/attendance": CalendarCheck,
  "/content": FolderOpen,
  "/quizzes": ListChecks,
  "/exams": FileText,
  "/performance": ClipboardCheck,
  "/questions": FileQuestionMark,
  "/audit": ScrollText,
};

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNav({
  items,
  onNavigate,
}: {
  items: readonly SidebarItem[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav className="flex-1 space-y-0.5">
      {items.map((item) => {
        const Icon = ICONS[item.href] ?? LayoutDashboard;
        const disabled = !!item.comingPhase;
        const active = !disabled && isActive(pathname, item.href);

        const inner = (
          <>
            {active ? (
              <span
                aria-hidden
                className="absolute top-1/2 left-0 h-5 w-1 -translate-y-1/2 rounded-r-full bg-primary"
              />
            ) : null}
            <Icon
              aria-hidden
              className={cn(
                "size-4 shrink-0 transition-colors",
                active
                  ? "text-primary"
                  : disabled
                    ? "text-muted-foreground/50"
                    : "text-muted-foreground group-hover:text-foreground",
              )}
            />
            <span className="flex-1 truncate">{item.label}</span>
            {item.comingPhase ? (
              <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {item.comingPhase}
              </span>
            ) : null}
          </>
        );

        const base =
          "group relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors";

        if (disabled) {
          return (
            <span
              key={item.href}
              className={cn(base, "cursor-not-allowed text-muted-foreground")}
            >
              {inner}
            </span>
          );
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              base,
              active
                ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground"
                : "font-medium text-muted-foreground hover:bg-muted hover:text-foreground",
              "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
            )}
          >
            {inner}
          </Link>
        );
      })}
    </nav>
  );
}
