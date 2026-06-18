import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-8">
      {/* Page Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div className="space-y-2">
          <Skeleton className="h-8 w-[200px]" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-3 w-3 rounded-full" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-32 rounded-xl" />
          <Skeleton className="h-10 w-32 rounded-xl" />
        </div>
      </div>

      {/* Toolbar / Filters Skeleton */}
      <div className="bg-card rounded-2xl border border-border shadow-sm p-4 flex gap-4 items-center">
        <Skeleton className="h-10 w-[200px] rounded-lg" />
        <Skeleton className="h-10 w-[150px] rounded-lg" />
        <Skeleton className="h-10 w-[150px] rounded-lg" />
        <div className="ml-auto">
          <Skeleton className="h-10 w-[100px] rounded-lg" />
        </div>
      </div>

      {/* Main Content Area Skeleton */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="border-b border-border p-4 flex gap-4">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-5 w-24 ml-auto" />
        </div>
        <div className="p-4 space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
              <Skeleton className="h-6 w-24 rounded-full" />
              <div className="flex gap-2">
                <Skeleton className="h-8 w-8 rounded-lg" />
                <Skeleton className="h-8 w-8 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
