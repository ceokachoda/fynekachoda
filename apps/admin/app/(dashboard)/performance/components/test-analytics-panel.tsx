"use client";

import { useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { FileSpreadsheet, Users, ArrowUpRight, ArrowDownRight, Award } from "lucide-react";
import type { OfflineScoreRow } from "../page";

interface Props {
  testName: string | null;
  rows: OfflineScoreRow[];
  onClose: () => void;
}

export function TestAnalyticsPanel({ testName, rows, onClose }: Props) {
  const open = !!testName;

  const testRows = useMemo(() => {
    if (!testName) return [];
    return rows.filter(r => r.test_name === testName);
  }, [testName, rows]);

  const stats = useMemo(() => {
    if (testRows.length === 0) return null;
    
    const scores = testRows.map(r => (r.score / r.max_score) * 100);
    const maxScoreVal = Math.max(...scores);
    const minScoreVal = Math.min(...scores);
    const avgScoreVal = scores.reduce((a, b) => a + b, 0) / scores.length;
    const passCount = scores.filter(s => s >= 40).length;
    const passRate = (passCount / scores.length) * 100;

    const distribution = { A: 0, B: 0, C: 0, D: 0, F: 0 };
    scores.forEach(s => {
      if (s >= 90) distribution.A++;
      else if (s >= 80) distribution.B++;
      else if (s >= 70) distribution.C++;
      else if (s >= 60) distribution.D++;
      else distribution.F++;
    });

    const sortedRows = [...testRows].sort((a, b) => (b.score / b.max_score) - (a.score / a.max_score));

    return { maxScoreVal, minScoreVal, avgScoreVal, passRate, distribution, sortedRows };
  }, [testRows]);

  return (
    <Sheet open={open} onOpenChange={(val) => { if (!val) onClose(); }}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto" aria-describedby="test-analytics-desc">
        <SheetHeader className="mb-6">
          <SheetTitle className="text-2xl font-bold flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-primary" />
            {testName}
          </SheetTitle>
          <SheetDescription id="test-analytics-desc">
            {testRows[0] ? `${testRows[0].subject_name || "General"} • ${testRows[0].test_date}` : "Loading details..."}
          </SheetDescription>
        </SheetHeader>

        {stats ? (
          <div className="space-y-8 mt-4">
            
            {/* Summary Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-muted/30 p-3 rounded-xl border border-border">
                <div className="text-[11px] font-medium text-muted-foreground mb-1 uppercase tracking-wider">Average</div>
                <div className="text-xl font-bold">{stats.avgScoreVal.toFixed(1)}%</div>
              </div>
              <div className="bg-muted/30 p-3 rounded-xl border border-border">
                <div className="text-[11px] font-medium text-muted-foreground mb-1 uppercase tracking-wider">Highest</div>
                <div className="text-xl font-bold flex items-center gap-1 text-emerald-600">
                  {stats.maxScoreVal.toFixed(0)}% <ArrowUpRight className="w-4 h-4" />
                </div>
              </div>
              <div className="bg-muted/30 p-3 rounded-xl border border-border">
                <div className="text-[11px] font-medium text-muted-foreground mb-1 uppercase tracking-wider">Lowest</div>
                <div className="text-xl font-bold flex items-center gap-1 text-destructive">
                  {stats.minScoreVal.toFixed(0)}% <ArrowDownRight className="w-4 h-4" />
                </div>
              </div>
              <div className="bg-muted/30 p-3 rounded-xl border border-border">
                <div className="text-[11px] font-medium text-muted-foreground mb-1 uppercase tracking-wider">Pass Rate</div>
                <div className="text-xl font-bold">{stats.passRate.toFixed(0)}%</div>
              </div>
            </div>

            {/* Score Distribution */}
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Users className="w-5 h-5" />
                Score Distribution
              </h3>
              <div className="flex items-end gap-2 h-32 bg-muted/20 p-4 rounded-xl border border-border">
                {Object.entries(stats.distribution).map(([grade, count]) => {
                  const pct = testRows.length > 0 ? (count / testRows.length) * 100 : 0;
                  return (
                    <div key={grade} className="flex-1 flex flex-col items-center gap-2 group">
                      <div className="text-xs font-medium text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                        {count}
                      </div>
                      <div 
                        className="w-full bg-primary/80 rounded-t-md transition-all group-hover:bg-primary" 
                        style={{ height: `${pct}%`, minHeight: count > 0 ? '4px' : '0' }}
                      />
                      <div className="text-sm font-bold text-foreground">{grade}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Top Performers */}
            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Award className="w-5 h-5 text-amber-500" />
                Top Performers
              </h3>
              <div className="space-y-2">
                {stats.sortedRows.slice(0, 5).map((r, i) => (
                  <div key={r.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border/50">
                    <div className="flex items-center gap-3">
                      <div className="w-6 text-center text-sm font-bold text-muted-foreground">#{i+1}</div>
                      <div className="font-medium text-sm">{r.student_name}</div>
                    </div>
                    <div className="font-bold text-emerald-600">
                      {((r.score / r.max_score) * 100).toFixed(1)}%
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        ) : (
          <div className="mt-8 text-center text-muted-foreground">No data available for this test.</div>
        )}
      </SheetContent>
    </Sheet>
  );
}
