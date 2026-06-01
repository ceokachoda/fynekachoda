"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  SidebarContent,
  type SidebarUser,
} from "@/components/sidebar-content";
import { type SidebarItem } from "@/components/sidebar-nav";

// Hamburger + slide-in drawer for narrow screens. Reuses the exact desktop
// sidebar interior and auto-closes on navigation.
export function MobileSidebar({
  items,
  user,
}: {
  items: readonly SidebarItem[];
  user: SidebarUser;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label="Open navigation menu"
          className="inline-flex size-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <Menu className="size-5" aria-hidden />
        </button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="w-[17rem] gap-0 bg-white p-0 sm:max-w-[17rem]"
      >
        <SheetTitle className="sr-only">Navigation menu</SheetTitle>
        <SidebarContent
          items={items}
          user={user}
          onNavigate={() => setOpen(false)}
        />
      </SheetContent>
    </Sheet>
  );
}
