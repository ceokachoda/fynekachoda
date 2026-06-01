export default function DashboardLoading() {
  return (
    <div
      className="fs-skeleton-screen space-y-6"
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">Loading…</span>

      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2.5">
          <div className="fs-skeleton h-7 w-52" />
          <div className="fs-skeleton h-4 w-28" />
        </div>
        <div className="fs-skeleton h-9 w-32" />
      </header>

      <div className="fs-skeleton h-10 w-full max-w-md" />

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center gap-4 border-b border-slate-100 px-4 py-3.5">
          <div className="fs-skeleton h-3 w-24" />
          <div className="fs-skeleton hidden h-3 w-32 sm:block" />
          <div className="fs-skeleton hidden h-3 w-20 md:block" />
          <div className="fs-skeleton ml-auto h-3 w-16" />
        </div>
        <div className="divide-y divide-slate-100">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 px-4 py-3.5"
              style={{ opacity: 1 - i * 0.085 }}
            >
              <div className="fs-skeleton h-4 w-40" />
              <div className="fs-skeleton hidden h-4 w-56 sm:block" />
              <div className="fs-skeleton hidden h-4 w-24 md:block" />
              <div className="fs-skeleton ml-auto h-5 w-16 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
