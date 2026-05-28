"use client";

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
      <ProfileMenu
        fullName={fullName}
        email={email}
        activeRole={activeRole}
        isMultiRole={isMultiRole}
        variant="compact"
      />
    </header>
  );
}
