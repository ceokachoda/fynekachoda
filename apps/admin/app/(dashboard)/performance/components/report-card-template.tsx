"use client";

import React from "react";

export interface ReportCardData {
  student: { id: string; name: string };
  batch: { name: string; course: string };
  scores: { test_name: string; test_date: string; subject: string; score: number; max_score: number }[];
  attendance?: { status: string }[];
}

interface Props {
  data: ReportCardData;
}

export function ReportCardTemplate({ data }: Props) {
  const { student, batch, scores, attendance } = data;

  // Aggregate scores by subject
  const subjectMap = new Map<string, { totalScore: number; totalMax: number }>();
  scores.forEach((s) => {
    const subj = s.subject || "General";
    const current = subjectMap.get(subj) || { totalScore: 0, totalMax: 0 };
    subjectMap.set(subj, {
      totalScore: current.totalScore + s.score,
      totalMax: current.totalMax + s.max_score,
    });
  });

  const subjectSummary = Array.from(subjectMap.entries()).map(([subj, vals]) => {
    const percentage = vals.totalMax > 0 ? (vals.totalScore / vals.totalMax) * 100 : 0;
    let grade = "F";
    if (percentage >= 90) grade = "A+";
    else if (percentage >= 80) grade = "A";
    else if (percentage >= 70) grade = "B";
    else if (percentage >= 60) grade = "C";
    else if (percentage >= 40) grade = "D";

    return { subject: subj, score: vals.totalScore, max: vals.totalMax, percentage, grade };
  });

  const overallScore = subjectSummary.reduce((acc, s) => acc + s.score, 0);
  const overallMax = subjectSummary.reduce((acc, s) => acc + s.max, 0);
  const overallPercentage = overallMax > 0 ? (overallScore / overallMax) * 100 : 0;
  
  let overallGrade = "F";
  if (overallPercentage >= 90) overallGrade = "A+";
  else if (overallPercentage >= 80) overallGrade = "A";
  else if (overallPercentage >= 70) overallGrade = "B";
  else if (overallPercentage >= 60) overallGrade = "C";
  else if (overallPercentage >= 40) overallGrade = "D";

  // Attendance
  let attendancePct = null;
  if (attendance && attendance.length > 0) {
    const presentCount = attendance.filter(a => a.status === "present" || a.status === "late").length;
    attendancePct = (presentCount / attendance.length) * 100;
  }

  // Generate Remarks
  let remarks = "Needs improvement.";
  if (overallPercentage >= 80) remarks = "Excellent performance! Keep up the good work.";
  else if (overallPercentage >= 60) remarks = "Good effort, but there is room for improvement.";
  else if (overallPercentage >= 40) remarks = "Passable, but significant improvement is needed.";

  return (
    <div className="w-full bg-white text-black p-8 sm:p-12 min-h-[1056px] print:w-[210mm] print:h-[297mm] print:p-10 print:m-0 mx-auto border border-gray-200 print:border-none print:shadow-none shadow-lg print:break-after-page box-border relative">
      {/* Header */}
      <div className="text-center mb-10 border-b-2 border-black pb-6">
        <h1 className="text-4xl font-bold uppercase tracking-widest text-black">FyneStudy Institute</h1>
        <p className="text-sm text-gray-600 mt-2">Academic Excellence & Performance Center</p>
        <h2 className="text-2xl font-semibold mt-6 uppercase tracking-widest bg-black text-white py-2 inline-block px-8 rounded-sm">
          Report Card
        </h2>
      </div>

      {/* Student Details */}
      <div className="grid grid-cols-2 gap-x-8 gap-y-4 mb-10">
        <div className="flex border-b border-gray-300 pb-1">
          <span className="font-semibold w-32 uppercase text-xs text-gray-500 tracking-wider">Student Name</span>
          <span className="font-bold text-lg">{student.name}</span>
        </div>
        <div className="flex border-b border-gray-300 pb-1">
          <span className="font-semibold w-32 uppercase text-xs text-gray-500 tracking-wider">Date of Issue</span>
          <span className="font-bold">{new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}</span>
        </div>
        <div className="flex border-b border-gray-300 pb-1">
          <span className="font-semibold w-32 uppercase text-xs text-gray-500 tracking-wider">Batch</span>
          <span className="font-bold">{batch.name}</span>
        </div>
        <div className="flex border-b border-gray-300 pb-1">
          <span className="font-semibold w-32 uppercase text-xs text-gray-500 tracking-wider">Course</span>
          <span className="font-bold">{batch.course}</span>
        </div>
      </div>

      {/* Academic Performance Table */}
      <div className="mb-10">
        <h3 className="text-lg font-bold uppercase tracking-widest mb-4 text-black border-b border-black inline-block pb-1">Academic Performance</h3>
        <table className="w-full text-left border-collapse border border-black">
          <thead className="bg-gray-100">
            <tr>
              <th className="border border-black p-3 font-semibold uppercase text-xs tracking-wider">Subject</th>
              <th className="border border-black p-3 font-semibold uppercase text-xs tracking-wider text-center">Marks Obtained</th>
              <th className="border border-black p-3 font-semibold uppercase text-xs tracking-wider text-center">Total Marks</th>
              <th className="border border-black p-3 font-semibold uppercase text-xs tracking-wider text-center">Percentage</th>
              <th className="border border-black p-3 font-semibold uppercase text-xs tracking-wider text-center">Grade</th>
            </tr>
          </thead>
          <tbody>
            {subjectSummary.length === 0 ? (
              <tr>
                <td colSpan={5} className="border border-black p-4 text-center text-gray-500 italic">No academic records found for this period.</td>
              </tr>
            ) : (
              subjectSummary.map((sub, idx) => (
                <tr key={idx} className="even:bg-gray-50">
                  <td className="border border-black p-3 font-medium">{sub.subject}</td>
                  <td className="border border-black p-3 text-center">{sub.score}</td>
                  <td className="border border-black p-3 text-center">{sub.max}</td>
                  <td className="border border-black p-3 text-center font-semibold">{sub.percentage.toFixed(1)}%</td>
                  <td className="border border-black p-3 text-center font-bold text-lg">{sub.grade}</td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot className="bg-gray-200 font-bold border-t-2 border-black">
            <tr>
              <td className="border border-black p-3 uppercase text-sm">Overall Result</td>
              <td className="border border-black p-3 text-center">{overallScore}</td>
              <td className="border border-black p-3 text-center">{overallMax}</td>
              <td className="border border-black p-3 text-center">{overallPercentage.toFixed(1)}%</td>
              <td className="border border-black p-3 text-center text-xl">{overallGrade}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Summary & Remarks */}
      <div className="grid grid-cols-2 gap-8 mb-12">
        <div>
          <h3 className="text-lg font-bold uppercase tracking-widest mb-3 text-black border-b border-black inline-block pb-1">Attendance Record</h3>
          <div className="bg-gray-100 p-6 border border-black rounded-sm flex items-center justify-center">
            <div className="text-center">
              <div className="text-4xl font-bold tracking-tighter">
                {attendancePct !== null ? `${attendancePct.toFixed(0)}%` : "N/A"}
              </div>
              <div className="text-xs uppercase text-gray-600 mt-2 font-semibold tracking-wider">Total Attendance</div>
            </div>
          </div>
        </div>
        <div>
          <h3 className="text-lg font-bold uppercase tracking-widest mb-3 text-black border-b border-black inline-block pb-1">Teacher&apos;s Remarks</h3>
          <div className="border border-black p-6 h-[116px] rounded-sm text-sm italic leading-relaxed bg-gray-50">
            &quot;{remarks}&quot;
          </div>
        </div>
      </div>

      {/* Signatures */}
      <div className="absolute bottom-12 left-12 right-12 flex justify-between pt-8 px-8">
        <div className="text-center w-48">
          <div className="border-b border-black mb-2 h-8"></div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-600">Class Teacher</p>
        </div>
        <div className="text-center w-48">
          <div className="border-b border-black mb-2 h-8"></div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-600">Principal / Director</p>
        </div>
      </div>
    </div>
  );
}
