import { createSupabaseServerClient } from "@/lib/supabase-server";
import { TrendingUp, AlertTriangle } from "lucide-react";
import Link from "next/link";

import { GenerateReportButton } from "../../performance/report-cards/components/generate-report-button";

interface Props {
  batchId: string;
}

export async function PerformanceSection({ batchId }: Props) {
  const supabase = await createSupabaseServerClient();

  const { data: scoresRes } = await supabase
    .from("offline_test_scores")
    .select("id, student_id, score, max_score, students!inner(app_users!inner(full_name))")
    .eq("batch_id", batchId);

  const scores = (scoresRes || []) as unknown as Array<{
    id: string;
    student_id: string;
    score: number;
    max_score: number;
    students: { app_users: { full_name: string } | null } | null;
  }>;

  if (scores.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/50 px-6 py-12 text-center text-sm text-muted-foreground">
        No performance records exist for this batch yet.
      </div>
    );
  }

  let totalScore = 0;
  let totalMax = 0;
  
  const studentStats: Record<string, { name: string; earned: number; possible: number; tests: number }> = {};

  scores.forEach(s => {
    totalScore += Number(s.score);
    totalMax += Number(s.max_score);
    
    let stat = studentStats[s.student_id];
    if (!stat) {
      stat = { name: s.students?.app_users?.full_name || "Unknown", earned: 0, possible: 0, tests: 0 };
      studentStats[s.student_id] = stat;
    }
    stat.earned += Number(s.score);
    stat.possible += Number(s.max_score);
    stat.tests += 1;
  });

  const batchAverage = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0;

  const rankedStudents = Object.entries(studentStats)
    .map(([id, stats]) => ({
      id,
      name: stats.name,
      pct: stats.possible > 0 ? Math.round((stats.earned / stats.possible) * 100) : 0,
      tests: stats.tests
    }))
    .sort((a, b) => b.pct - a.pct);

  const topPerformers = rankedStudents.slice(0, 5);
  const atRiskStudents = rankedStudents.filter(s => s.pct < 40 && s.tests > 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">Performance Analytics</h2>
        <GenerateReportButton batchId={batchId} variant="outline" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="col-span-1 bg-card rounded-2xl border border-border shadow-sm p-6 flex flex-col items-center justify-center text-center">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">Batch Average</h3>
          <div className="text-5xl font-bold text-primary mb-2">{batchAverage}%</div>
          <p className="text-xs text-muted-foreground">Across {scores.length} total score entries</p>
        </div>

        <div className="col-span-1 md:col-span-2 bg-card rounded-2xl border border-border shadow-sm p-6">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-500" />
            Top Performers
          </h3>
          <div className="space-y-3">
            {topPerformers.map((s, i) => (
              <div key={s.id} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-3">
                  <div className="w-5 text-muted-foreground font-medium">{i + 1}.</div>
                  <Link href={`/students/${s.id}?tab=performance`} className="font-medium hover:underline text-foreground">
                    {s.name}
                  </Link>
                </div>
                <div className="font-medium text-emerald-600">{s.pct}%</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {atRiskStudents.length > 0 && (
        <div className="bg-destructive/5 rounded-2xl border border-destructive/20 p-6">
          <h3 className="text-sm font-semibold text-destructive mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            At-Risk Students
          </h3>
          <p className="text-sm text-destructive/80 mb-4">
            The following students are averaging below 40% across their assessments and may require intervention.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {atRiskStudents.map((s) => (
              <Link 
                key={s.id} 
                href={`/students/${s.id}?tab=performance`}
                className="bg-background rounded-lg border border-destructive/20 p-3 hover:border-destructive/40 transition-colors flex justify-between items-center"
              >
                <div className="font-medium text-sm text-foreground truncate pr-2">{s.name}</div>
                <div className="text-sm font-bold text-destructive shrink-0">{s.pct}%</div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
