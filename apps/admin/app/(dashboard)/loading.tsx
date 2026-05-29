export default function DashboardLoading() {
  return (
    <div
      className="space-y-6"
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">Loading…</span>

      <header className="flex items-center justify-between">
        <div className="space-y-2.5">
          <div className="h-7 w-52 animate-pulse rounded-md bg-slate-200" />
          <div className="h-4 w-28 animate-pulse rounded bg-slate-100" />
        </div>
        <div className="h-9 w-32 animate-pulse rounded-md bg-slate-200" />
      </header>

      <div className="h-10 w-full max-w-md animate-pulse rounded-md bg-slate-100" />

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="h-11 border-b border-slate-200 bg-slate-50" />
        <div className="divide-y divide-slate-100">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 px-4 py-3.5"
              style={{ opacity: 1 - i * 0.085 }}
            >
              <div className="h-4 w-40 animate-pulse rounded bg-slate-200" />
              <div className="hidden h-4 w-56 animate-pulse rounded bg-slate-100 sm:block" />
              <div className="hidden h-4 w-24 animate-pulse rounded bg-slate-100 md:block" />
              <div className="ml-auto h-5 w-16 animate-pulse rounded-full bg-slate-100" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
