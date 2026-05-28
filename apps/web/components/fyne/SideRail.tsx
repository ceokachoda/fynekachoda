"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FyneLogo } from "./FyneLogo";
import { ProfileMenu } from "./ProfileMenu";
import { STUDENT_NAV, TEACHER_NAV } from "./nav-items";
import { cn } from "@/lib/utils";
import type { ActiveRole } from "@/lib/auth";

interface SideRailProps {
  activeRole: ActiveRole;
  fullName: string;
  email: string;
  isMultiRole: boolean;
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SideRail({
  activeRole,
  fullName,
  email,
  isMultiRole,
}: SideRailProps) {
  const pathname = usePathname() ?? "/";
  const items = activeRole === "student" ? STUDENT_NAV : TEACHER_NAV;

  return (
    <aside className="sticky top-0 hidden h-svh w-[256px] flex-col border-r border-slate-200 bg-white px-4 py-6 lg:flex">
      <div className="mb-8 px-2">
        <FyneLogo variant="header" />
      </div>

      <nav className="flex-1 space-y-1" aria-label="Primary">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors",
                active
                  ? "bg-blue-50 text-primary"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
              )}
            >
              <Icon className={cn("size-5", active ? "text-primary" : "text-slate-500")} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-100 pt-4">
        <ProfileMenu
          fullName={fullName}
          email={email}
          activeRole={activeRole}
          isMultiRole={isMultiRole}
          variant="full"
        />
      </div>
    </aside>
  );
}
