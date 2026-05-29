import { Skeleton } from "@/components/ui/skeleton";

// Shown in the content area (the shell stays mounted) while a protected page's
// server data loads. A light, layout-shaped skeleton reads as "this page is
// loading" far more smoothly than flashing the full-screen logo splash on every
// tab switch. The RouteProgress bar handles the top-of-page buffering cue.
export default function ProtectedLoading() {
  return (
    <div className="space-y-6" role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>

      <div className="space-y-2.5">
        <Skeleton className="h-8 w-56 rounded-lg" />
        <Skeleton className="h-4 w-32 rounded" />
      </div>

      <Skeleton className="h-40 w-full rounded-[28px]" />

      <div className="flex gap-3">
        <Skeleton className="h-20 flex-1 rounded-2xl" />
        <Skeleton className="h-20 flex-1 rounded-2xl" />
        <Skeleton className="h-20 flex-1 rounded-2xl" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-36 w-full rounded-2xl" />
        <Skeleton className="h-36 w-full rounded-2xl" />
      </div>
    </div>
  );
}
