import { cn } from "@/lib/utils";

interface FocusLayoutProps {
  children: React.ReactNode;
  className?: string;
}

// Full-screen, no rail / no bottom tabs — used by future quiz/exam/live/etc.
// routes that need an immersive view. Phase 1 stub.
export function FocusLayout({ children, className }: FocusLayoutProps) {
  return (
    <div className={cn("min-h-svh w-full bg-background", className)}>
      {children}
    </div>
  );
}
