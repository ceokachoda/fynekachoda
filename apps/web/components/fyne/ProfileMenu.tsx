"use client";

import Link from "next/link";
import { ChevronsUpDown, LogOut, RefreshCcw, User } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOutAction } from "@/app/actions/sign-out";
import { setActiveRoleAction } from "@/app/actions/set-active-role";
import { unsubscribeWebPush } from "@/lib/web-push";
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

const AVATAR_GRADIENT = "bg-gradient-to-br from-primary to-blue-700";

export function ProfileMenu({
  fullName,
  email,
  activeRole,
  isMultiRole,
  variant = "full",
}: ProfileMenuProps) {
  const otherRole: ActiveRole = activeRole === "student" ? "teacher" : "student";
  const isFull = variant === "full";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "group flex items-center outline-none transition-colors",
          isFull
            ? "w-full gap-3 rounded-2xl border border-slate-200 bg-white px-2.5 py-2 text-left hover:border-slate-300 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2"
            : "rounded-full p-0.5 focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2",
        )}
        aria-label={`Open profile menu for ${fullName}`}
      >
        <span
          className={cn(
            "inline-flex shrink-0 items-center justify-center rounded-full text-sm font-bold text-white shadow-sm",
            AVATAR_GRADIENT,
            isFull ? "size-9" : "size-9",
          )}
        >
          {initials(fullName) || <User className="size-4" />}
        </span>
        {isFull ? (
          <>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-bold leading-tight text-slate-900">
                {fullName}
              </span>
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {activeRole}
              </span>
            </span>
            <ChevronsUpDown className="size-4 shrink-0 text-slate-400 transition-colors group-hover:text-slate-600" />
          </>
        ) : null}
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align={isFull ? "start" : "end"}
        side={isFull ? "top" : "bottom"}
        sideOffset={10}
        className="w-64 rounded-2xl p-1.5 shadow-xl"
      >
        <div className="flex items-center gap-3 px-2.5 py-2.5">
          <span
            className={cn(
              "inline-flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white shadow-sm",
              AVATAR_GRADIENT,
            )}
          >
            {initials(fullName) || <User className="size-4" />}
          </span>
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-bold text-slate-900">
              {fullName}
            </span>
            <span className="truncate text-xs text-slate-500">{email}</span>
          </div>
        </div>

        <div className="mb-1 px-2.5">
          <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-primary">
            {activeRole}
          </span>
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <Link
            href="/profile"
            className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm font-medium text-slate-700"
          >
            <User className="size-4 text-slate-500" />
            View profile
          </Link>
        </DropdownMenuItem>

        {isMultiRole ? (
          <form action={setActiveRoleAction}>
            <input type="hidden" name="role" value={otherRole} />
            <DropdownMenuItem asChild>
              <button
                type="submit"
                className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm font-medium text-slate-700"
              >
                <RefreshCcw className="size-4 text-slate-500" />
                Switch to {otherRole}
              </button>
            </DropdownMenuItem>
          </form>
        ) : null}

        <DropdownMenuSeparator />

        <form action={signOutAction}>
          <DropdownMenuItem asChild>
            <button
              type="submit"
              onClick={() => {
                // Best-effort: stop pushes to this browser before the session ends.
                void unsubscribeWebPush();
              }}
              className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm font-semibold text-red-600 focus:bg-red-50 focus:text-red-700"
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
