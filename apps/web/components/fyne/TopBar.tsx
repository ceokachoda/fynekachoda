"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { FyneLogo } from "./FyneLogo";
import { ProfileMenu } from "./ProfileMenu";
import type { ActiveRole } from "@/lib/auth";

interface TopBarProps {
  fullName: string;
  email: string;
  activeRole: ActiveRole;
  isMultiRole: boolean;
}

export function TopBar({ fullName, email, activeRole, isMultiRole }: TopBarProps) {
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur lg:hidden">
      <FyneLogo variant="header" />
      <div className="flex items-center gap-1.5">
        <Link
          href="/notifications"
          aria-label="Notifications"
          className="flex size-9 items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2"
        >
          <Bell className="size-5" />
        </Link>
        <ProfileMenu
          fullName={fullName}
          email={email}
          activeRole={activeRole}
          isMultiRole={isMultiRole}
          variant="compact"
        />
      </div>
    </header>
  );
}
