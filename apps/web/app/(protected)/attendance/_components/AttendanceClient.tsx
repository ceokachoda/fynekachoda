"use client";

import { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Calendar, Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { QrDisplay } from "@/components/attendance/QrDisplay";
import { AttendanceRing } from "@/components/attendance/AttendanceRing";
import { AttendanceHistoryList } from "@/components/attendance/AttendanceHistoryList";
import { useTodaySessions } from "@/features/attendance/useTodaySessions";
import { useAttendanceHistory } from "@/features/attendance/useAttendanceHistory";
import { useAttendanceRealtime } from "@/features/attendance/useAttendanceRealtime";
import { formatIstTime } from "@/lib/ist";

export function AttendanceClient() {
  const today = useTodaySessions();
  const history = useAttendanceHistory();
  const qc = useQueryClient();
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  useAttendanceRealtime(() => {
    qc.invalidateQueries({ queryKey: ["today-sessions"] });
    qc.invalidateQueries({ queryKey: ["attendance-history"] });
  });

  const sessions = useMemo(() => today.data ?? [], [today.data]);
  const eligible = useMemo(
    () => sessions.filter((s) => s.window === "open" && s.attendance_status === null),
    [sessions],
  );
  const activeSessionId = selectedSessionId ?? eligible[0]?.id ?? null;
  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? null;
  const sessionLabel = activeSession?.subject_name ?? "Today's class";

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-extrabold text-slate-900">Attendance</h1>
        <p className="mt-1 text-sm text-slate-500">
          Show your QR to the teacher to mark yourself present.
        </p>
      </div>

      {today.isLoading ? (
        <Skeleton className="h-72 w-full rounded-[28px]" />
      ) : activeSessionId ? (
        <div className="flex flex-col items-center">
          <QrDisplay sessionId={activeSessionId} sessionLabel={sessionLabel} />
          {eligible.length > 1 ? (
            <div className="mt-4 flex flex-wrap gap-2 justify-center">
              {eligible.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSelectedSessionId(s.id)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                    s.id === activeSessionId
                      ? "border-primary bg-primary text-white"
                      : "border-slate-200 bg-white text-slate-700"
                  }`}
                >
                  {s.subject_name}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="rounded-[28px] border border-slate-100 bg-white p-8 text-center">
          <Calendar className="mx-auto mb-2 size-8 text-slate-400" />
          <p className="text-sm font-semibold text-slate-700">
            No class window open
          </p>
          <p className="mt-1 text-xs text-slate-500">
            QR will appear when a class starts.
          </p>
        </div>
      )}

      <section className="rounded-2xl border border-slate-100 bg-white p-4">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
          Today&apos;s classes
        </h2>
        {today.isLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : sessions.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-500">
            No classes scheduled today.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {sessions.map((s) => (
              <li key={s.id} className="flex items-center py-3">
                <Clock className="mr-3 size-4 text-slate-400" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {s.subject_name}
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatIstTime(s.scheduled_start)} – {formatIstTime(s.scheduled_end)}
                  </p>
                </div>
                <span
                  className={`rounded-md px-2 py-1 text-[11px] font-bold ${
                    s.attendance_status === "present"
                      ? "bg-emerald-50 text-emerald-700"
                      : s.attendance_status === "late"
                        ? "bg-amber-50 text-amber-700"
                        : s.attendance_status === "absent"
                          ? "bg-red-50 text-red-700"
                          : s.window === "open"
                            ? "bg-blue-50 text-blue-700"
                            : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {s.attendance_status
                    ? s.attendance_status.charAt(0).toUpperCase() +
                      s.attendance_status.slice(1)
                    : s.window === "open"
                      ? "Open"
                      : s.window === "before"
                        ? "Soon"
                        : "Closed"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-slate-100 bg-white p-4">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
          My history
        </h2>
        {history.isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : history.error ? (
          <p className="text-sm text-red-700">Couldn&apos;t load history.</p>
        ) : history.data ? (
          <>
            <div className="mb-4 flex">
              <AttendanceRing
                label="This week"
                present={history.data.weekPresent}
                total={history.data.weekTotal}
              />
              <AttendanceRing
                label="Last 30 days"
                present={history.data.monthPresent}
                total={history.data.monthTotal}
              />
            </div>
            <AttendanceHistoryList rows={history.data.recent} />
          </>
        ) : null}
      </section>
    </div>
  );
}
