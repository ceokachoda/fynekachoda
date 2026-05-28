"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { STUDENT_NAV, TEACHER_NAV } from "./nav-items";
import { cn } from "@/lib/utils";
import type { ActiveRole } from "@/lib/auth";

interface BottomTabsProps {
  activeRole: ActiveRole;
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function BottomTabs({ activeRole }: BottomTabsProps) {
  const pathname = usePathname() ?? "/";
  const items = activeRole === "student" ? STUDENT_NAV : TEACHER_NAV;

  return (
    <nav
      aria-label="Primary"
      className="fixed bottom-0 left-0 right-0 z-30 flex h-16 items-stretch border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] shadow-[0_-1px_0_rgba(15,23,42,0.04)] lg:hidden"
    >
      <ul className="flex w-full items-stretch overflow-x-auto">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <li key={item.href} className="min-w-[64px] flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-full flex-col items-center justify-center gap-1 px-2 text-[11px] font-semibold transition-colors",
                  active ? "text-primary" : "text-slate-500 hover:text-slate-700",
                )}
              >
                <Icon className="size-5" />
                <span className="leading-none">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
