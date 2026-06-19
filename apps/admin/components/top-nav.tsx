"use client";

import { MobileSidebar } from "@/components/mobile-sidebar";
import { FyneLogo } from "@/components/fyne-logo";
import { type SidebarItem } from "@/components/sidebar-nav";
import { type SidebarUser } from "@/components/sidebar-content";

export function TopNav({
  items,
  user,
}: {
  items: readonly SidebarItem[];
  user: SidebarUser;
}) {
  return (
    <header className="md:hidden sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4">
      <div className="flex items-center gap-4">
        <MobileSidebar items={items} user={user} />
        <FyneLogo variant="header" />
      </div>
    </header>
  );
}

