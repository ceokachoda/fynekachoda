"use client";

import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { getStudentProfile } from "../actions";
import { GraduationCap, BookOpen, Calendar, TrendingUp, AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  studentId: string | null;
  onClose: () => void;
}

type ProfileData = Awaited<ReturnType<typeof getStudentProfile>>;

export function StudentProfilePanel({ studentId, onClose }: Props) {
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!studentId) {
      setData(null);
      return;
    }
    let active = true;
    setLoading(true);
    getStudentProfile(studentId).then((res) => {
      if (active) {
        setData(res);
        setLoading(false);
      }
    }).catch(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [studentId]);

  const open = !!studentId;

  const totalTests = data?.scores.length || 0;
  const avgScore = data?.scores.reduce((acc, s) => acc + (s.score / s.max_score) * 100, 0) || 0;
  const avgPercentage = totalTests > 0 ? avgScore / totalTests : 0;
  
  const subjects = new Set(data?.scores.map(s => s.subject));

  return (
    <Sheet open={open} onOpenChange={(val) => { if (!val) onClose(); }}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto" aria-describedby="student-profile-desc">
        <SheetHeader className="mb-6">
          <SheetTitle className="text-2xl font-bold flex items-center gap-2">
            <GraduationCap className="w-6 h-6 text-primary" />
            {data?.student.name || "Student Profile"}
          </SheetTitle>
          <SheetDescription id="student-profile-desc">
            {data ? `${data.student.batch} • ${data.student.course}` : "Loading details..."}
          </SheetDescription>
        </SheetHeader>

        {loading ? (
          <div className="space-y-6 mt-4">
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-48 w-full rounded-xl" />
            <Skeleton className="h-48 w-full rounded-xl" />
          </div>
        ) : data ? (
          <div className="space-y-8 mt-4">
            
            {/* Summary Cards */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-muted/40 p-4 rounded-xl border border-border">
                <div className="flex items-center gap-2 text-muted-foreground text-sm font-medium mb-2">
                  <TrendingUp className="w-4 h-4" />
                  Academic Average
                </div>
                <div className="text-3xl font-bold">{avgPercentage.toFixed(1)}%</div>
                <div className="text-xs text-muted-foreground mt-1">Across {totalTests} tests</div>
              </div>
              <div className="bg-muted/40 p-4 rounded-xl border border-border">
                <div className="flex items-center gap-2 text-muted-foreground text-sm font-medium mb-2">
                  <Calendar className="w-4 h-4" />
                  Attendance
                </div>
                <div className="text-3xl font-bold">
                  {data.attendance.percentage !== null ? `${data.attendance.percentage.toFixed(1)}%` : "N/A"}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {data.attendance.present} / {data.attendance.total} sessions
                </div>
              </div>
            </div>

            {/* Subject Performance */}
            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <BookOpen className="w-5 h-5" />
                Subject Performance
              </h3>
              <div className="space-y-3">
                {Array.from(subjects).map(subject => {
                  const subScores = data.scores.filter(s => s.subject === subject);
                  const subAvg = subScores.reduce((acc, s) => acc + (s.score / s.max_score) * 100, 0) / subScores.length;
                  return (
                    <div key={subject} className="bg-card border border-border p-3 rounded-lg flex flex-col gap-2 shadow-sm">
                      <div className="flex justify-between items-center text-sm font-medium">
                        <span>{subject}</span>
                        <span className={subAvg < 40 ? "text-destructive" : "text-emerald-600"}>{subAvg.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                        <div 
                          className={`h-full ${subAvg < 40 ? "bg-destructive" : "bg-primary"}`}
                          style={{ width: `${subAvg}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Test History */}
            <div>
              <h3 className="text-lg font-semibold mb-3">Recent Tests</h3>
              <div className="border border-border rounded-xl overflow-hidden divide-y divide-border">
                {data.scores.length === 0 && (
                  <div className="p-4 text-center text-sm text-muted-foreground">No test scores recorded yet.</div>
                )}
                {data.scores.map(score => {
                  const pct = (score.score / score.max_score) * 100;
                  return (
                    <div key={score.id} className="p-3 hover:bg-muted/30 transition-colors flex items-center justify-between">
                      <div>
                        <div className="font-medium text-sm">{score.test_name}</div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">{score.subject} • {score.test_date}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-sm">{pct.toFixed(0)}%</div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">{score.score} / {score.max_score}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* AI Warning (if needed) */}
            {avgPercentage < 40 && (
              <div className="bg-destructive/10 border border-destructive/20 p-4 rounded-xl flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-destructive text-sm">Academic Alert</h4>
                  <p className="text-xs text-destructive/80 mt-1">
                    This student is performing below the required academic standards. Intervention is recommended.
                  </p>
                </div>
              </div>
            )}

          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
