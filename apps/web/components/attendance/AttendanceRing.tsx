export function AttendanceRing({
  label,
  present,
  total,
}: {
  label: string;
  present: number;
  total: number;
}) {
  const pct = total === 0 ? 0 : Math.round((present / total) * 100);
  return (
    <div className="flex flex-1 flex-col items-center">
      <div className="mb-2 flex size-20 flex-col items-center justify-center rounded-full bg-blue-50">
        <span className="text-2xl font-extrabold text-blue-700">{pct}</span>
        <span className="-mt-1 text-[10px] font-semibold text-blue-700">%</span>
      </div>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-0.5 text-xs text-slate-400">
        {present} / {total} {total === 1 ? "class" : "classes"}
      </p>
    </div>
  );
}
