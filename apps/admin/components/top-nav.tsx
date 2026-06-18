"use client";

import { useEffect, useRef } from "react";
import { Search } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { MobileSidebar } from "@/components/mobile-sidebar";
import { FyneLogo } from "@/components/fyne-logo";
import { type SidebarItem } from "@/components/sidebar-nav";
import { type SidebarUser } from "@/components/sidebar-content";
import { Input } from "@/components/ui/input";

export function TopNav({
  items,
  user,
}: {
  items: readonly SidebarItem[];
  user: SidebarUser;
}) {
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 md:px-6">
      <div className="flex items-center gap-4 md:hidden">
        <MobileSidebar items={items} user={user} />
        <FyneLogo variant="header" />
      </div>

      <div className="hidden md:flex flex-1 items-center gap-4 max-w-sm">
        <div className="relative w-full">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            type="search"
            aria-label="Search across FyneStudy"
            placeholder="Search... (Cmd+K)"
            className="w-full bg-muted shadow-none appearance-none pl-8 rounded-lg h-10 border-transparent focus-visible:bg-background focus-visible:border-ring transition-colors"
          />
        </div>
      </div>

      <div className="flex items-center gap-3 ml-auto">
        <ThemeToggle />
      </div>
    </header>
  );
}

