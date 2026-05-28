"use client";

import type { ReactNode } from "react";
import { SideRail } from "./SideRail";
import { TopBar } from "./TopBar";
import { BottomTabs } from "./BottomTabs";
import type { ActiveRole } from "@/lib/auth";

interface AppShellProps {
  fullName: string;
  email: string;
  activeRole: ActiveRole;
  isMultiRole: boolean;
  children: ReactNode;
}

// Responsive shell. Client Component so lucide icon references (functions)
// stay inside the client subtree — passing icon functions as props from a
// Server Component to a Client Component trips RSC serialization with
// "Functions cannot be passed directly to Client Components".
//   lg+   → SideRail (left) + content
//   < lg  → TopBar + content + BottomTabs (fixed bottom)
export function AppShell({
  fullName,
  email,
  activeRole,
  isMultiRole,
  children,
}: AppShellProps) {
  return (
    <div className="flex min-h-svh bg-muted/40">
      <SideRail
        activeRole={activeRole}
        fullName={fullName}
        email={email}
        isMultiRole={isMultiRole}
      />

      <div className="flex min-h-svh flex-1 flex-col">
        <TopBar
          fullName={fullName}
          email={email}
          activeRole={activeRole}
          isMultiRole={isMultiRole}
        />
        <main className="flex-1 px-4 pb-24 pt-4 lg:px-8 lg:pb-8 lg:pt-8">
          <div className="mx-auto w-full max-w-5xl">{children}</div>
        </main>
        <BottomTabs activeRole={activeRole} />
      </div>
    </div>
  );
}
