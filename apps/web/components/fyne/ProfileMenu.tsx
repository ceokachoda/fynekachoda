"use client";

import { LogOut, RefreshCcw, User } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOutAction } from "@/app/actions/sign-out";
import { setActiveRoleAction } from "@/app/actions/set-active-role";
import { cn } from "@/lib/utils";
import type { ActiveRole } from "@/lib/auth";

interface ProfileMenuProps {
  fullName: string;
  email: string;
  activeRole: ActiveRole;
  isMultiRole: boolean;
  /** Compact = avatar-only trigger (mobile TopBar). Full = avatar + name (desktop SideRail). */
  variant?: "compact" | "full";
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function ProfileMenu({
  fullName,
  email,
  activeRole,
  isMultiRole,
  variant = "full",
}: ProfileMenuProps) {
  const otherRole: ActiveRole = activeRole === "student" ? "teacher" : "student";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "group flex items-center gap-3 rounded-2xl px-2 py-1.5 text-left outline-none transition-colors hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2",
          variant === "compact" && "p-1",
        )}
        aria-label={`Open profile menu for ${fullName}`}
      >
        <span className="inline-flex size-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
          {initials(fullName) || <User className="size-4" />}
        </span>
        {variant === "full" ? (
          <span className="hidden flex-col sm:flex">
            <span className="text-sm font-bold text-slate-900 leading-tight">
              {fullName}
            </span>
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {activeRole}
            </span>
          </span>
        ) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={6} className="min-w-[240px]">
        <DropdownMenuLabel className="flex flex-col">
          <span className="text-sm font-semibold text-slate-900">{fullName}</span>
          <span className="text-xs text-slate-500">{email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {isMultiRole ? (
          <form action={setActiveRoleAction}>
            <input type="hidden" name="role" value={otherRole} />
            <DropdownMenuItem asChild>
              <button
                type="submit"
                className="flex w-full cursor-pointer items-center gap-2 text-sm"
              >
                <RefreshCcw className="size-4" />
                Switch to {otherRole}
              </button>
            </DropdownMenuItem>
          </form>
        ) : null}
        <form action={signOutAction}>
          <DropdownMenuItem asChild>
            <button
              type="submit"
              className="flex w-full cursor-pointer items-center gap-2 text-sm text-red-600 focus:bg-red-50 focus:text-red-700"
            >
              <LogOut className="size-4" />
              Sign out
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
