"use client";

import { LogOut } from "lucide-react";
import { FyneLogo } from "@/components/fyne-logo";
import { SidebarNav, type SidebarItem } from "@/components/sidebar-nav";
import { logoutAction } from "@/app/actions/logout";

export interface SidebarUser {
  fullName: string;
  email: string;
  isOwnerAdmin: boolean;
  initials: string;
}

// The full sidebar interior (brand header + nav + account footer). Shared by the
// desktop rail and the mobile drawer so both stay in sync. `onNavigate` lets the
// mobile drawer close itself when a link is tapped.
export function SidebarContent({
  items,
  user,
  onNavigate,
}: {
  items: readonly SidebarItem[];
  user: SidebarUser;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center px-5 pt-5 pb-3">
        <FyneLogo variant="header" />
      </div>
      <p className="px-5 pb-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
        Admin panel
      </p>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-3">
        <SidebarNav items={items} onNavigate={onNavigate} />
      </div>

      <form action={logoutAction} className="border-t border-border p-3">
        <div className="mb-2 flex items-center gap-3 px-2 py-1.5">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-dark text-xs font-semibold text-primary-foreground shadow-sm">
            {user.initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">
              {user.fullName}
            </p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          </div>
        </div>
        <div className="mb-3 px-2">
          <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-secondary-foreground">
            {user.isOwnerAdmin ? "Owner admin" : "Staff admin"}
          </span>
        </div>
        <button
          type="submit"
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <LogOut className="size-4" aria-hidden />
          Sign out
        </button>
      </form>
    </div>
  );
}
