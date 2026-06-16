"use client";

// Styled wrapper around a native <select>. Native selects render in the OS
// layer, so they never get clipped by a scrolling parent (the bug a custom
// popover dropdown hit inside the bottom sheet) and are the most touch-reliable
// option on low-end Android. The chevron is decorative; appearance-none hides
// the platform arrow so the affordance is consistent across browsers.

import * as React from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

function NativeSelect({
  className,
  children,
  ...props
}: React.ComponentProps<"select">) {
  return (
    <div className="relative">
      <select
        data-slot="native-select"
        className={cn(
          "h-12 w-full appearance-none rounded-xl border border-slate-200 bg-white px-4 pr-10 text-base font-medium text-slate-900 shadow-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 md:text-sm",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400"
        aria-hidden
      />
    </div>
  );
}

export { NativeSelect };
