"use client";

import React from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

interface DataTableLayoutProps {
  searchPlaceholder?: string;
  onSearch?: (value: string) => void;
  actions?: React.ReactNode;
  filters?: React.ReactNode;
  children: React.ReactNode;
  pagination?: React.ReactNode;
}

export function DataTableLayout({
  searchPlaceholder = "Search...",
  onSearch,
  actions,
  filters,
  children,
  pagination,
}: DataTableLayoutProps) {
  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-1 items-center gap-2">
          {onSearch && (
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={searchPlaceholder}
                className="pl-8 bg-background"
                onChange={(e) => onSearch(e.target.value)}
              />
            </div>
          )}
          {filters && <div className="flex items-center gap-2">{filters}</div>}
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>

      {/* Table Container */}
      <div className="rounded-md border border-border bg-background overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          {children}
        </div>
      </div>

      {/* Pagination Footer */}
      {pagination && (
        <div className="flex items-center justify-end px-2">
          {pagination}
        </div>
      )}
    </div>
  );
}
