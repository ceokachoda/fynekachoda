"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet";
import { correctAttendanceAction, type AttendanceCorrectState } from "./actions";
import type { AttendanceCell } from "./page";
import {
  Download,
  Filter,
  BarChart3,
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  XCircle,
  Clock,
  Info,
  ChevronRight,
  UserCircle2
} from "lucide-react";
import { cn } from "@/lib/utils";

interface BatchOption {
  id: string;
  name: string;
  course_code: string;
}

interface StudentRow {
  user_id: string;
  full_name: string;
  email: string;
}

interface SessionCol {
  id: string;
  scheduled_start: string;
  scheduled_end: string;
  subject_name: string | null;
  title: string | null;
  is_ad_hoc: boolean;
}

function sessionName(s: { title: string | null; subject_name: string | null }): string {
  return s.title?.trim() || s.subject_name?.trim() || "Class";
}

interface Props {
  selectedDate: string;
  selectedBatchId?: string;
  selectedSessionId?: string;
  batches: BatchOption[];
  students: StudentRow[];
  sessions: SessionCol[];
  cellsRecord: Record<string, AttendanceCell>;
}

const REASON_PRESETS = [
  "Late entry confirmed",
  "QR scan failed",
  "Teacher error",
  "Other",
];

function formatColumnTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateDisplay(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}

function getInitials(name: string) {
  return name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();
}

function StatusBadge({ status }: { status?: "present" | "late" | "absent" }) {
  if (!status) return <span className="text-muted-foreground text-xs font-medium bg-muted px-2 py-1 rounded-md">— Unmarked</span>;
  if (status === "present") return (
    <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 px-2 py-1 rounded-md font-medium text-xs border border-emerald-200 dark:border-emerald-500/20 w-fit">
      <CheckCircle2 className="w-3.5 h-3.5" /> Present
    </div>
  );
  if (status === "late") return (
    <div className="flex items-center gap-1.5 bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 px-2 py-1 rounded-md font-medium text-xs border border-amber-200 dark:border-amber-500/20 w-fit">
      <Clock className="w-3.5 h-3.5" /> Late
    </div>
  );
  return (
    <div className="flex items-center gap-1.5 bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400 px-2 py-1 rounded-md font-medium text-xs border border-red-200 dark:border-red-500/20 w-fit">
      <XCircle className="w-3.5 h-3.5" /> Absent
    </div>
  );
}

function escapeCsvCell(value: string | number): string {
  const s = String(value);
  if (/[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

const initialCorrection: AttendanceCorrectState = {};

export function AttendanceMatrix({
  selectedDate,
  selectedBatchId,
  selectedSessionId,
  batches,
  students,
  sessions,
  cellsRecord,
}: Props) {
  const router = useRouter();
  const [pendingNav, startTransition] = useTransition();
  const cells = useMemo(() => new Map(Object.entries(cellsRecord)), [cellsRecord]);
  const selectedBatch = batches.find((b) => b.id === selectedBatchId);

  // Filter sessions for the selected day
  const targetDayStart = new Date(`${selectedDate}T00:00:00+05:30`).getTime();
  const targetDayEnd = targetDayStart + 24 * 60 * 60 * 1000;
  
  const todaySessions = useMemo(() => {
    return sessions.filter(s => {
      const time = new Date(s.scheduled_start).getTime();
      return time >= targetDayStart && time < targetDayEnd;
    });
  }, [sessions, targetDayStart, targetDayEnd]);

  const activeSessions = selectedSessionId 
    ? todaySessions.filter(s => s.id === selectedSessionId) 
    : todaySessions;

  // Global 30-day analytics
  const thirtyDayStats = useMemo(() => {
    let present = 0, late = 0, absent = 0;
    const studentStats = new Map<string, { total: number, presentAndLate: number }>();

    for (const [key, cell] of cells.entries()) {
      const studentId = key.split("|")[1];
      if (!studentId) continue;
      if (!studentStats.has(studentId)) {
        studentStats.set(studentId, { total: 0, presentAndLate: 0 });
      }
      const stats = studentStats.get(studentId)!;
      stats.total += 1;
      
      if (cell.status === "present") {
        present++;
        stats.presentAndLate++;
      } else if (cell.status === "late") {
        late++;
        stats.presentAndLate++;
      } else {
        absent++;
      }
    }

    const totalMarked = present + late + absent;
    const overallPercentage = totalMarked === 0 ? 0 : Math.round(((present + late) / totalMarked) * 100);

    const riskStudents: Array<{student: StudentRow, percentage: number, total: number}> = [];
    for (const [studentId, stats] of studentStats.entries()) {
      if (stats.total > 0) {
        const pct = Math.round((stats.presentAndLate / stats.total) * 100);
        if (pct < 75) {
          const stu = students.find(s => s.user_id === studentId);
          if (stu) {
            riskStudents.push({ student: stu, percentage: pct, total: stats.total });
          }
        }
      }
    }
    
    riskStudents.sort((a, b) => a.percentage - b.percentage);

    return { present, late, absent, overallPercentage, riskStudents, studentStats };
  }, [cells, students]);

  // Today's specific analytics based on activeSessions
  const todayStats = useMemo(() => {
    let present = 0, late = 0, absent = 0, unmarked = 0;
    for (const s of activeSessions) {
      for (const stu of students) {
        const c = cells.get(`${s.id}|${stu.user_id}`);
        if (!c) unmarked++;
        else if (c.status === "present") present++;
        else if (c.status === "late") late++;
        else absent++;
      }
    }
    const totalMarked = present + late + absent;
    const pct = totalMarked === 0 ? 0 : Math.round(((present + late) / totalMarked) * 100);
    return { present, late, absent, unmarked, pct, total: totalMarked + unmarked };
  }, [activeSessions, students, cells]);

  const [editing, setEditing] = useState<{
    student: StudentRow;
    session: SessionCol;
    cell: AttendanceCell;
  } | null>(null);
  const [draftStatus, setDraftStatus] = useState<"present" | "late" | "absent" | null>(null);
  const [draftReason, setDraftReason] = useState("");

  const [selectedStudent, setSelectedStudent] = useState<StudentRow | null>(null);

  const [state, formAction, pending] = useActionState(
    correctAttendanceAction,
    initialCorrection,
  );

  useEffect(() => {
    if (state.ok) {
      setEditing(null);
      setDraftReason("");
      setDraftStatus(null);
      router.refresh();
    }
  }, [state, router]);

  function applyFilters(form: HTMLFormElement) {
    const fd = new FormData(form);
    const sp = new URLSearchParams();
    const d = String(fd.get("date") ?? "");
    const b = String(fd.get("batch") ?? "");
    const s = String(fd.get("session") ?? "");
    if (d) sp.set("date", d);
    if (b) sp.set("batch", b);
    if (s) sp.set("session", s);
    startTransition(() => {
      router.push(`/attendance?${sp.toString()}`);
    });
  }

  function exportCsv() {
    if (!selectedBatch) return;
    const header = [
      "Roll No (Placeholder)",
      "Student Name",
      "Email",
      "Batch",
      "Date",
      "Session",
      "Status",
      "Marked Method",
      "Marked Time"
    ];
    const lines = [header.map(escapeCsvCell).join(",")];
    
    for (const sess of activeSessions) {
      for (const stu of students) {
        const c = cells.get(`${sess.id}|${stu.user_id}`);
        const row: string[] = [
          "N/A", // Roll No
          stu.full_name,
          stu.email,
          selectedBatch.name,
          selectedDate,
          sessionName(sess),
          c ? c.status.toUpperCase() : "UNMARKED",
          c ? c.method : "",
          c ? new Date(c.marked_at).toLocaleString() : ""
        ];
        lines.push(row.map(escapeCsvCell).join(","));
      }
    }

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const safeName = selectedBatch.name.replace(/[^a-z0-9-]+/gi, "_");
    a.href = url;
    a.download = `attendance_${safeName}_${selectedDate}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6 animate-in-fade pb-8">
      {/* Filters Toolbar */}
      <div className="bg-card rounded-xl border shadow-sm p-4 sticky top-0 z-40 backdrop-blur-md bg-card/95">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            applyFilters(e.currentTarget);
          }}
          className="flex flex-col sm:flex-row items-end gap-4"
        >
          <div className="flex flex-1 items-end gap-4 flex-wrap">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="date" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Select Date</label>
              <Input id="date" name="date" type="date" defaultValue={selectedDate} className="w-40 h-10 bg-background" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="batch" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Batch</label>
              <div className="relative">
                <select
                  id="batch"
                  name="batch"
                  defaultValue={selectedBatchId ?? ""}
                  className="h-10 w-64 appearance-none rounded-md border border-input bg-background pl-3 pr-8 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring shadow-sm"
                  onChange={(e) => {
                    // Reset session when batch changes, submit form automatically to reload
                    const form = e.currentTarget.closest('form');
                    if(form) {
                      const sessionSelect = form.querySelector('[name="session"]') as HTMLSelectElement;
                      if(sessionSelect) sessionSelect.value = "";
                      applyFilters(form);
                    }
                  }}
                >
                  <option value="">Select Batch...</option>
                  {batches.map((b) => (
                    <option key={b.id} value={b.id}>{b.course_code} · {b.name}</option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-muted-foreground">
                  <Filter className="h-4 w-4" />
                </div>
              </div>
            </div>
            
            {selectedBatchId && (
              <div className="flex flex-col gap-1.5">
                <label htmlFor="session" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Class / Subject</label>
                <div className="relative">
                  <select
                    id="session"
                    name="session"
                    defaultValue={selectedSessionId ?? ""}
                    className="h-10 w-64 appearance-none rounded-md border border-input bg-background pl-3 pr-8 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring shadow-sm"
                    onChange={(e) => {
                      const form = e.currentTarget.closest('form');
                      if(form) applyFilters(form);
                    }}
                  >
                    <option value="">All Sessions Today ({todaySessions.length})</option>
                    {todaySessions.map((s) => (
                      <option key={s.id} value={s.id}>{formatColumnTime(s.scheduled_start)} - {sessionName(s)}</option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-muted-foreground">
                    <Filter className="h-4 w-4" />
                  </div>
                </div>
              </div>
            )}
            
            <Button type="submit" className="h-10 px-6 hidden md:flex">View Attendance</Button>
          </div>

          <Button
            type="button"
            variant="outline"
            className="h-10 gap-2 shrink-0 bg-background"
            disabled={!selectedBatchId || activeSessions.length === 0 || students.length === 0}
            onClick={exportCsv}
          >
            <Download className="h-4 w-4" /> Export Today
          </Button>
        </form>
      </div>

      {!selectedBatchId ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 px-6 py-24 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <CalendarDays className="w-8 h-8 text-muted-foreground/50" />
          </div>
          <h3 className="text-xl font-semibold text-foreground mb-2">Enterprise Attendance System</h3>
          <p className="text-sm text-muted-foreground max-w-md">Select a date and batch from the filters above to view and manage attendance records.</p>
        </div>
      ) : students.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 px-6 py-24 text-center">
          <p className="text-sm text-muted-foreground">No students found in this batch.</p>
        </div>
      ) : activeSessions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 px-6 py-24 text-center">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4 mx-auto">
            <Info className="w-8 h-8 text-muted-foreground/50" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-1">No Sessions Scheduled</h3>
          <p className="text-sm text-muted-foreground">There are no classes scheduled for {formatDateDisplay(selectedDate)}.</p>
        </div>
      ) : (
        <div className="flex flex-col xl:flex-row gap-6">
          
          {/* Main Content Area */}
          <div className="flex-1 space-y-6 min-w-0">
            {/* KPI Header */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="col-span-2 lg:col-span-5 flex items-center justify-between bg-muted/30 px-4 py-2 rounded-lg border">
                 <div className="flex items-center gap-2 text-sm font-medium">
                   <CalendarDays className="w-4 h-4 text-muted-foreground" />
                   {formatDateDisplay(selectedDate)}
                   <span className="text-muted-foreground mx-2">|</span>
                   <span className="font-semibold">{selectedBatch?.name}</span>
                 </div>
                 {selectedSessionId && (
                   <div className="text-sm font-medium bg-background px-3 py-1 rounded-full border shadow-sm">
                     {activeSessions.length === 1 && activeSessions[0] ? sessionName(activeSessions[0]) : "Multiple Sessions"}
                   </div>
                 )}
              </div>
              <div className="bg-card border rounded-xl p-4 shadow-sm flex flex-col gap-1 justify-center relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <BarChart3 className="w-10 h-10" />
                </div>
                <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Attendance %</p>
                <div className="flex items-end gap-2">
                  <p className="text-3xl font-bold">{todayStats.pct}%</p>
                </div>
              </div>
              <div className="bg-card border rounded-xl p-4 shadow-sm flex flex-col gap-1 justify-center">
                <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Total Students</p>
                <p className="text-3xl font-bold">{students.length}</p>
              </div>
              <div className="bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20 border rounded-xl p-4 shadow-sm flex flex-col gap-1 justify-center text-emerald-900 dark:text-emerald-50">
                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold uppercase tracking-wider">Present</p>
                <p className="text-3xl font-bold">{todayStats.present}</p>
              </div>
              <div className="bg-red-50 dark:bg-red-500/10 border-red-100 dark:border-red-500/20 border rounded-xl p-4 shadow-sm flex flex-col gap-1 justify-center text-red-900 dark:text-red-50">
                <p className="text-xs text-red-600 dark:text-red-400 font-semibold uppercase tracking-wider">Absent</p>
                <p className="text-3xl font-bold">{todayStats.absent}</p>
              </div>
              <div className="bg-amber-50 dark:bg-amber-500/10 border-amber-100 dark:border-amber-500/20 border rounded-xl p-4 shadow-sm flex flex-col gap-1 justify-center text-amber-900 dark:text-amber-50">
                <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold uppercase tracking-wider">Late</p>
                <p className="text-3xl font-bold">{todayStats.late}</p>
              </div>
            </div>

            {/* Enterprise Table */}
            <div className="bg-card rounded-xl border shadow-sm overflow-hidden flex flex-col relative">
              <div className="px-4 py-3 border-b bg-muted/20 flex justify-between items-center">
                <h3 className="font-semibold text-foreground">Attendance Roster</h3>
                <span className="text-xs text-muted-foreground">{activeSessions.length} Session(s) Displayed</span>
              </div>
              <div className={`overflow-x-auto max-h-[600px] transition-opacity duration-200 ${pendingNav ? "opacity-50 pointer-events-none" : ""}`}>
                {pendingNav && (
                  <div className="absolute inset-0 flex items-center justify-center z-30">
                    <div className="h-8 w-8 rounded-full border-4 border-primary border-r-transparent animate-spin"></div>
                  </div>
                )}
                <table className="w-full text-sm text-left border-collapse">
                  <thead className="bg-muted/50 sticky top-0 z-20 backdrop-blur-md shadow-[0_1px_0_0_var(--color-border)]">
                    <tr>
                      <th className="px-4 py-3 font-semibold text-muted-foreground uppercase tracking-wider text-[11px] w-12 text-center">#</th>
                      <th className="px-4 py-3 font-semibold text-muted-foreground uppercase tracking-wider text-[11px]">Student</th>
                      <th className="px-4 py-3 font-semibold text-muted-foreground uppercase tracking-wider text-[11px]">Batch</th>
                      {activeSessions.map(s => (
                        <th key={s.id} className="px-4 py-3 font-semibold text-muted-foreground uppercase tracking-wider text-[11px] min-w-[180px]">
                          <div className="flex flex-col">
                            <span className="text-foreground">{sessionName(s)}</span>
                            <span className="text-[10px]">{formatColumnTime(s.scheduled_start)}</span>
                          </div>
                        </th>
                      ))}
                      <th className="px-4 py-3 font-semibold text-muted-foreground uppercase tracking-wider text-[11px] text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {students.map((stu, idx) => (
                      <tr 
                        key={stu.user_id} 
                        className="hover:bg-muted/30 transition-colors group cursor-pointer"
                        onClick={() => setSelectedStudent(stu)}
                      >
                        <td className="px-4 py-3 text-center text-muted-foreground text-xs">{idx + 1}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                              {getInitials(stu.full_name)}
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="font-medium text-foreground truncate">{stu.full_name}</span>
                              <span className="text-[11px] text-muted-foreground truncate">{stu.email}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                          {selectedBatch?.course_code}
                        </td>
                        {activeSessions.map(s => {
                          const c = cells.get(`${s.id}|${stu.user_id}`);
                          return (
                            <td key={s.id} className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                              <div className="flex flex-col gap-1.5 items-start">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if(!c) return;
                                    setEditing({ student: stu, session: s, cell: c });
                                    setDraftStatus(null);
                                    setDraftReason("");
                                  }}
                                  disabled={!c}
                                  className={cn("text-left transition-transform", c ? "hover:scale-105" : "opacity-70 cursor-not-allowed")}
                                  title={c ? "Click to Correct Attendance" : "Not marked yet"}
                                >
                                  <StatusBadge status={c?.status} />
                                </button>
                                {c && (
                                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                                    <span className="bg-muted px-1.5 py-0.5 rounded uppercase tracking-wider">{c.method}</span>
                                    <span>{new Date(c.marked_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                  </div>
                                )}
                              </div>
                            </td>
                          );
                        })}
                        <td className="px-4 py-3 text-right">
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={(e) => { e.stopPropagation(); setSelectedStudent(stu); }}>
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right Insights Panel */}
          <div className="xl:w-80 space-y-6 shrink-0">
            <div className="bg-card rounded-xl border shadow-sm p-5">
              <h3 className="font-semibold flex items-center gap-2 mb-4">
                <BarChart3 className="w-4 h-4 text-primary" />
                30-Day Insights
              </h3>
              <div className="space-y-5">
                <div>
                  <div className="flex justify-between items-end mb-2">
                    <span className="text-sm font-medium text-muted-foreground">Overall Attendance</span>
                    <span className="text-xl font-bold">{thirtyDayStats.overallPercentage}%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                    <div 
                      className={cn("h-full", thirtyDayStats.overallPercentage >= 75 ? "bg-emerald-500" : thirtyDayStats.overallPercentage >= 60 ? "bg-amber-500" : "bg-red-500")}
                      style={{ width: `${thirtyDayStats.overallPercentage}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1 text-right">Based on last 30 days of records</p>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-3 border-t">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Total Classes</p>
                    <p className="text-lg font-semibold">{sessions.length}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Risk Students</p>
                    <p className="text-lg font-semibold text-red-500">{thirtyDayStats.riskStudents.length}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-card rounded-xl border shadow-sm flex flex-col max-h-[400px]">
              <div className="p-4 border-b bg-red-50/50 dark:bg-red-500/5">
                <h3 className="font-semibold flex items-center gap-2 text-red-600 dark:text-red-400">
                  <AlertTriangle className="w-4 h-4" />
                  At-Risk Students (&lt;75%)
                </h3>
              </div>
              <div className="p-2 overflow-y-auto">
                {thirtyDayStats.riskStudents.length === 0 ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">
                    No students currently at risk.
                  </div>
                ) : (
                  <div className="space-y-1">
                    {thirtyDayStats.riskStudents.map(({student, percentage, total}) => (
                      <button 
                        key={student.user_id}
                        className="w-full flex items-center justify-between p-2 hover:bg-muted/50 rounded-lg transition-colors text-left"
                        onClick={() => setSelectedStudent(student)}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <div className="w-6 h-6 rounded-full bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400 flex items-center justify-center text-[10px] font-bold shrink-0">
                            {getInitials(student.full_name)}
                          </div>
                          <span className="text-sm font-medium truncate">{student.full_name}</span>
                        </div>
                        <div className="flex flex-col items-end shrink-0 pl-2">
                          <span className={cn("text-xs font-bold", percentage < 60 ? "text-red-600" : "text-amber-600")}>
                            {percentage}%
                          </span>
                          <span className="text-[10px] text-muted-foreground">{total} classes</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      )}

      {/* Editing Dialog */}
      <Dialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEditing(null);
            setDraftReason("");
            setDraftStatus(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">
              Correct Attendance
            </DialogTitle>
            <DialogDescription>
              {editing
                ? `Modifying record for ${editing.student.full_name} on ${formatDateDisplay(editing.session.scheduled_start)}.`
                : ""}
            </DialogDescription>
          </DialogHeader>

          <form action={formAction} className="space-y-6 pt-2">
            {editing ? (
              <input
                type="hidden"
                name="attendance_id"
                value={editing.cell.attendance_id}
              />
            ) : null}

            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Set New Status
              </p>
              <div className="flex gap-3">
                {(["present", "late", "absent"] as const).map((s) => (
                  <label
                    key={s}
                    className={cn(
                      "flex-1 cursor-pointer rounded-xl border-2 px-3 py-3 text-center text-sm font-bold transition-all hover:shadow-sm flex flex-col items-center gap-2",
                      draftStatus === s
                        ? s === "present"
                          ? "border-emerald-500 bg-emerald-500 text-white shadow-md shadow-emerald-500/20"
                          : s === "late"
                            ? "border-amber-500 bg-amber-500 text-white shadow-md shadow-amber-500/20"
                            : "border-destructive bg-destructive text-white shadow-md shadow-destructive/20"
                        : "border-border bg-card text-foreground hover:border-primary/30"
                    )}
                  >
                    <input
                      type="radio"
                      name="new_status"
                      value={s}
                      checked={draftStatus === s}
                      onChange={() => setDraftStatus(s)}
                      className="sr-only"
                    />
                    {s === "present" && <CheckCircle2 className="w-5 h-5" />}
                    {s === "late" && <Clock className="w-5 h-5" />}
                    {s === "absent" && <XCircle className="w-5 h-5" />}
                    {s.toUpperCase()}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Correction Reason
              </p>
              <div className="mb-3 flex flex-wrap gap-2">
                {REASON_PRESETS.map((r) => (
                  <button
                    type="button"
                    key={r}
                    onClick={() => setDraftReason(r)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                      draftReason === r
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-muted text-foreground hover:bg-muted/80"
                    )}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <Input
                name="reason"
                value={draftReason}
                onChange={(e) => setDraftReason(e.target.value)}
                placeholder="Type a reason for this audit log (min 3 chars)"
                maxLength={500}
                className="h-10"
              />
            </div>

            {state.error ? (
              <p className="text-sm font-medium text-destructive bg-destructive/10 px-3 py-2 rounded-md">{state.error}</p>
            ) : null}

            <DialogFooter className="gap-2 sm:gap-0">
              <DialogClose asChild>
                <Button type="button" variant="outline" className="w-full sm:w-auto">
                  Cancel
                </Button>
              </DialogClose>
              <Button
                type="submit"
                className="w-full sm:w-auto"
                disabled={
                  pending ||
                  draftStatus === null ||
                  draftReason.trim().length < 3
                }
              >
                {pending ? "Saving Correction…" : "Confirm Correction"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Student Drill-down Drawer */}
      <Sheet open={selectedStudent !== null} onOpenChange={(open) => !open && setSelectedStudent(null)}>
        <SheetContent className="sm:max-w-md w-full overflow-y-auto">
          {selectedStudent && (
             <div className="space-y-6 pt-6">
               <div className="flex flex-col items-center text-center space-y-3 pb-6 border-b">
                 <div className="w-20 h-20 rounded-full bg-primary/10 text-primary flex items-center justify-center text-2xl font-bold">
                   {getInitials(selectedStudent.full_name)}
                 </div>
                 <div>
                   <h2 className="text-xl font-bold">{selectedStudent.full_name}</h2>
                   <p className="text-sm text-muted-foreground">{selectedStudent.email}</p>
                 </div>
                 <div className="flex items-center gap-2 text-xs font-medium px-3 py-1 bg-muted rounded-full">
                   <UserCircle2 className="w-4 h-4" /> {selectedBatch?.name}
                 </div>
               </div>

               <div>
                 <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">30-Day Attendance Snapshot</h3>
                 
                 {(() => {
                   const stats = thirtyDayStats.studentStats.get(selectedStudent.user_id) || { total: 0, presentAndLate: 0 };
                   const pct = stats.total > 0 ? Math.round((stats.presentAndLate / stats.total) * 100) : 0;
                   return (
                     <div className="grid grid-cols-2 gap-4">
                       <div className="bg-muted/50 p-4 rounded-xl border text-center">
                         <p className="text-xs text-muted-foreground uppercase font-semibold mb-1">Percentage</p>
                         <p className={cn("text-3xl font-bold", pct >= 75 ? "text-emerald-500" : pct >= 60 ? "text-amber-500" : "text-red-500")}>
                           {pct}%
                         </p>
                       </div>
                       <div className="bg-muted/50 p-4 rounded-xl border text-center">
                         <p className="text-xs text-muted-foreground uppercase font-semibold mb-1">Classes Attended</p>
                         <p className="text-3xl font-bold text-foreground">
                           {stats.presentAndLate} <span className="text-lg text-muted-foreground">/ {stats.total}</span>
                         </p>
                       </div>
                     </div>
                   );
                 })()}
               </div>

               <div>
                 <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">Recent Records</h3>
                 <div className="space-y-3">
                   {sessions.slice().reverse().slice(0, 10).map(s => {
                     const c = cells.get(`${s.id}|${selectedStudent.user_id}`);
                     return (
                       <div key={s.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                         <div className="flex flex-col">
                           <span className="font-medium text-sm">{sessionName(s)}</span>
                           <span className="text-xs text-muted-foreground">{formatDateDisplay(s.scheduled_start)} at {formatColumnTime(s.scheduled_start)}</span>
                         </div>
                         <StatusBadge status={c?.status} />
                       </div>
                     );
                   })}
                   {sessions.length === 0 && (
                     <p className="text-sm text-muted-foreground text-center py-4">No recent sessions found.</p>
                   )}
                 </div>
               </div>
             </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
