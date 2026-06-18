import { createSupabaseServerClient } from "@/lib/supabase-server";
import { ReportCardTemplate, ReportCardData } from "@/components/report-card-template";
import { notFound } from "next/navigation";

export default async function PrintReportCardPage({
  searchParams,
}: {
  searchParams: Promise<{ batch_id?: string; test_name?: string; student_id?: string }>;
}) {
  const { batch_id, test_name, student_id } = await searchParams;

  if (!batch_id || !test_name) {
    return <div className="p-10 text-red-500">Missing batch_id or test_name parameters.</div>;
  }

  const supabase = await createSupabaseServerClient();

  // Fetch Batch
  const { data: batch } = await supabase
    .from("batches")
    .select("name, starts_on, ends_on")
    .eq("id", batch_id)
    .single();

  if (!batch) return notFound();

  // Fetch Scores
  let query = supabase
    .from("offline_test_scores")
    .select("student_id, score, max_score, notes, subjects(name), students!inner(enrollment_no, app_users!inner(full_name))")
    .eq("batch_id", batch_id)
    .eq("test_name", test_name);

  if (student_id) {
    query = query.eq("student_id", student_id);
  }

  const { data: scoresRes } = await query;
  if (!scoresRes || scoresRes.length === 0) {
    return <div className="p-10 text-red-500">No scores found for the selected criteria.</div>;
  }

  // Fetch Attendance for the batch
  const { data: attendanceRes } = await supabase
    .from("attendance")
    .select("student_id, status, class_sessions!inner(batch_id)")
    .eq("class_sessions.batch_id", batch_id);

  const attendanceMap: Record<string, { present: number; total: number }> = {};
  if (attendanceRes) {
    for (const record of attendanceRes) {
      let att = attendanceMap[record.student_id];
      if (!att) {
        att = { present: 0, total: 0 };
        attendanceMap[record.student_id] = att;
      }
      att.total += 1;
      if (record.status === "present" || record.status === "late") {
        att.present += 1;
      }
    }
  }

  // Group scores by student
  const studentDataMap = new Map<string, ReportCardData>();
  
  const startYear = batch.starts_on ? new Date(batch.starts_on).getFullYear() : new Date().getFullYear();
  const endYear = batch.ends_on ? new Date(batch.ends_on).getFullYear().toString().slice(2) : (startYear + 1).toString().slice(2);
  const academicYear = `${startYear}-${endYear}`;
  
  const reportDate = new Date().toLocaleDateString("en-GB", { day: 'numeric', month: 'short', year: 'numeric' }); // 15 Oct 2024 format

  for (const row of scoresRes as unknown as Array<{ student_id: string; score: number; max_score: number; notes: string | null; subjects: { name: string } | null; students: { enrollment_no: string; app_users: { full_name: string } } }>) {
    if (!studentDataMap.has(row.student_id)) {
      const att = attendanceMap[row.student_id];
      const attendancePct = att && att.total > 0 ? Math.round((att.present / att.total) * 100) : "N/A";

      studentDataMap.set(row.student_id, {
        studentName: row.students.app_users.full_name,
        studentId: row.students.enrollment_no,
        batchName: batch.name,
        academicYear,
        reportDate,
        attendancePct,
        scores: []
      });
    }

    studentDataMap.get(row.student_id)!.scores.push({
      subject: row.subjects?.name || "General",
      maxScore: row.max_score,
      score: row.score,
      notes: row.notes || ""
    });
  }

  const reportCards = Array.from(studentDataMap.values()).sort((a, b) => a.studentName.localeCompare(b.studentName));

  return (
    <div className="bg-[#f0f0f0] min-h-screen py-10 print:py-0 print:bg-white">
      <div className="flex justify-center mb-8 print:hidden">
        <button 
          onClick={() => window.print()}
          className="bg-[#1c3f94] text-white px-6 py-3 rounded-lg font-bold shadow-lg hover:bg-[#153073] transition-colors"
        >
          Print Report Cards ({reportCards.length})
        </button>
      </div>
      
      <div className="space-y-10 print:space-y-0">
        {reportCards.map((rc, idx) => (
          <ReportCardTemplate key={idx} data={rc} />
        ))}
      </div>
    </div>
  );
}
