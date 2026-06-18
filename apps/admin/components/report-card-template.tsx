"use client";

import React from "react";
import { FyneLogo } from "@/components/fyne-logo";

export interface ReportCardData {
  studentName: string;
  studentId: string;
  batchName: string;
  academicYear: string;
  reportDate: string;
  attendancePct: number | string;
  scores: {
    subject: string;
    maxScore: number;
    score: number;
    notes: string;
  }[];
}

function getGrade(pct: number): string {
  if (pct >= 90) return "A+";
  if (pct >= 80) return "A";
  if (pct >= 70) return "B+";
  if (pct >= 60) return "B";
  if (pct >= 50) return "C";
  if (pct >= 40) return "D";
  return "F";
}

export function ReportCardTemplate({ data }: { data: ReportCardData }) {
  let totalMax = 0;
  let totalEarned = 0;

  data.scores.forEach(s => {
    totalMax += s.maxScore;
    totalEarned += s.score;
  });

  const totalPct = totalMax > 0 ? Math.round((totalEarned / totalMax) * 100) : 0;
  const overallGrade = getGrade(totalPct);

  return (
    <div className="relative w-[210mm] h-[297mm] mx-auto bg-[#fefdfa] border border-gray-200 shadow-sm print:shadow-none print:border-none p-10 overflow-hidden print:w-full print:h-screen print:page-break-after-always">
      {/* Background Watermark */}
      <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none">
        <FyneLogo className="w-[120%] h-auto text-primary" />
      </div>

      <div className="relative z-10 flex flex-col h-full">
        {/* Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <FyneLogo className="w-12 h-12 text-[#1c3f94] mb-2" />
          <h1 className="text-3xl font-extrabold tracking-wider text-[#1c3f94] mb-1 uppercase">Fynestudy</h1>
          <h2 className="text-xl font-bold tracking-widest text-[#1e293b]">FYNESTUDY COACHING</h2>
          <p className="text-sm font-medium text-gray-600 mb-4">Laitumkharah, Shillong, Meghalaya - 793003</p>
          <div className="w-full border-b-2 border-gray-800 mb-4"></div>
          <h3 className="text-2xl font-black tracking-widest uppercase text-gray-900">Student Academic Report Card</h3>
        </div>

        {/* Info Grid */}
        <div className="flex justify-between items-start mb-6">
          <table className="text-sm font-semibold text-gray-800">
            <tbody>
              <tr>
                <td className="py-1 pr-6 uppercase tracking-wider text-gray-500">Name:</td>
                <td className="py-1 text-base">{data.studentName}</td>
              </tr>
              <tr>
                <td className="py-1 pr-6 uppercase tracking-wider text-gray-500">Student ID:</td>
                <td className="py-1">{data.studentId || "—"}</td>
              </tr>
              <tr>
                <td className="py-1 pr-6 uppercase tracking-wider text-gray-500">Batch/Session:</td>
                <td className="py-1">{data.batchName}</td>
              </tr>
              <tr>
                <td className="py-1 pr-6 uppercase tracking-wider text-gray-500">Academic Year:</td>
                <td className="py-1">{data.academicYear}</td>
              </tr>
              <tr>
                <td className="py-1 pr-6 uppercase tracking-wider text-gray-500">Report Card Date:</td>
                <td className="py-1">{data.reportDate}</td>
              </tr>
            </tbody>
          </table>
          <div className="w-28 h-36 border-2 border-gray-400 bg-white/50 flex items-center justify-center text-xs font-semibold text-gray-400 text-center uppercase tracking-widest">
            Student<br />Photo
          </div>
        </div>

        {/* Main Scores Table */}
        <table className="w-full border-collapse border-2 border-gray-800 mb-6 text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="border-2 border-gray-800 py-2 px-4 text-left uppercase tracking-wider w-[40%]">Subject</th>
              <th className="border-2 border-gray-800 py-2 px-4 text-center uppercase tracking-wider w-[15%]">Max. Marks</th>
              <th className="border-2 border-gray-800 py-2 px-4 text-center uppercase tracking-wider w-[15%]">Marks Obtained</th>
              <th className="border-2 border-gray-800 py-2 px-4 text-center uppercase tracking-wider w-[15%]">%</th>
              <th className="border-2 border-gray-800 py-2 px-4 text-center uppercase tracking-wider w-[15%]">Grade</th>
            </tr>
          </thead>
          <tbody>
            {data.scores.map((s, i) => {
              const pct = s.maxScore > 0 ? Math.round((s.score / s.maxScore) * 100) : 0;
              return (
                <tr key={i} className="bg-white">
                  <td className="border-2 border-gray-800 py-2 px-4 font-bold text-gray-800">{s.subject}</td>
                  <td className="border-2 border-gray-800 py-2 px-4 text-center">{s.maxScore}</td>
                  <td className="border-2 border-gray-800 py-2 px-4 text-center font-semibold">{s.score}</td>
                  <td className="border-2 border-gray-800 py-2 px-4 text-center">{pct}%</td>
                  <td className="border-2 border-gray-800 py-2 px-4 text-center font-bold">{getGrade(pct)}</td>
                </tr>
              );
            })}
            <tr className="bg-gray-200 font-bold">
              <td className="border-2 border-gray-800 py-2 px-4 text-center uppercase tracking-widest text-base">Total</td>
              <td className="border-2 border-gray-800 py-2 px-4 text-center text-base">{totalMax}</td>
              <td className="border-2 border-gray-800 py-2 px-4 text-center text-base">{totalEarned}</td>
              <td className="border-2 border-gray-800 py-2 px-4 text-center text-base">{totalPct}%</td>
              <td className="border-2 border-gray-800 py-2 px-4 text-center text-base">{overallGrade}</td>
            </tr>
          </tbody>
        </table>

        {/* Remarks Table */}
        <table className="w-full border-collapse border-2 border-gray-800 mb-6 text-sm">
          <tbody>
            {data.scores.map((s, i) => (
              <tr key={i} className="bg-white">
                <td className="border-2 border-gray-800 py-2 px-4 font-bold text-gray-800 w-[25%]">{s.subject}</td>
                <td className="border-2 border-gray-800 py-2 px-4 text-gray-700 italic">
                  {s.notes || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Stats Row */}
        <div className="flex gap-4 mb-6">
          <div className="flex-1 border-2 border-gray-800 py-2 px-4 font-bold text-sm bg-white flex items-center justify-between">
            <span className="uppercase tracking-widest text-gray-600">Attendance (%):</span>
            <span className="text-gray-900">{data.attendancePct}%</span>
          </div>
          <div className="flex-1 border-2 border-gray-800 py-2 px-4 font-bold text-sm bg-white flex items-center justify-between">
            <span className="uppercase tracking-widest text-gray-600">Conduct:</span>
            <span className="text-gray-400 font-normal italic">_________</span>
          </div>
          <div className="flex-1 border-2 border-gray-800 py-2 px-4 font-bold text-sm bg-white flex items-center justify-between">
            <span className="uppercase tracking-widest text-gray-600">Participation:</span>
            <span className="text-gray-400 font-normal italic">_________</span>
          </div>
        </div>

        {/* Feedback Section */}
        <div className="border-2 border-gray-800 p-6 bg-white mb-auto">
          <div className="mb-8">
            <h4 className="font-bold uppercase tracking-widest text-gray-900 mb-6 text-sm">Overall Remarks & Teacher Feedback</h4>
            <div className="border-b border-gray-400 mb-8 w-full"></div>
            <div className="border-b border-gray-400 mb-8 w-full"></div>
          </div>
          <div>
            <h4 className="font-bold uppercase tracking-widest text-gray-900 mb-6 text-sm">Next Term Goals</h4>
            <div className="border-b border-gray-400 mb-8 w-full"></div>
          </div>
        </div>

        {/* Signatures */}
        <div className="flex justify-between items-end mt-12 mb-4 px-4">
          <div className="flex flex-col items-center">
            <div className="w-48 border-b-2 border-gray-800 mb-2"></div>
            <span className="text-xs font-bold text-gray-600 uppercase tracking-widest">Class Teacher&apos;s Signature</span>
          </div>
          <div className="flex flex-col items-center">
            <div className="w-48 border-b-2 border-gray-800 mb-2"></div>
            <span className="text-xs font-bold text-gray-600 uppercase tracking-widest">Director&apos;s Signature</span>
          </div>
          <div className="flex flex-col items-center">
            <div className="w-48 border-b-2 border-gray-800 mb-2"></div>
            <span className="text-xs font-bold text-gray-600 uppercase tracking-widest">Parent/Guardian&apos;s Signature</span>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-6 pt-4 border-t-2 border-gray-200">
          <span className="text-sm font-black text-[#1c3f94] tracking-[0.3em] uppercase">
            Learn • Grow • Succeed
          </span>
        </div>
      </div>
    </div>
  );
}
