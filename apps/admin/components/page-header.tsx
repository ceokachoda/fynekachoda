"use client";

import React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Breadcrumb {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  title: string;
  breadcrumbs?: Breadcrumb[];
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  breadcrumbs,
  description,
  actions,
  children,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center", className)}>
      <div className="space-y-1 min-w-0">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav aria-label="Breadcrumb" className="flex items-center space-x-1 text-sm text-muted-foreground">
            {breadcrumbs.map((bc, idx) => {
              const isLast = idx === breadcrumbs.length - 1;
              return (
                <div key={bc.label} className="flex items-center">
                  {bc.href && !isLast ? (
                    <Link href={bc.href} className="hover:text-foreground transition-colors hover:underline">
                      {bc.label}
                    </Link>
                  ) : (
                    <span className={cn(isLast && "text-foreground font-medium")}>{bc.label}</span>
                  )}
                  {!isLast && <ChevronRight className="h-4 w-4 mx-1" />}
                </div>
              );
            })}
          </nav>
        )}
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl truncate">
          {title}
        </h1>
        {description && (
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {(actions || children) && (
        <div className="flex w-full shrink-0 items-center gap-3 sm:w-auto mt-4 sm:mt-0">
          {actions}
          {children}
        </div>
      )}
    </div>
  );
}
