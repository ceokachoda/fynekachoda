"use client";

import { useMemo, useState } from "react";
import { importStudentsAction, type ImportResult } from "./actions";
import { Button } from "@/components/ui/button";

interface Batch {
  id: string;
  name: string;
}

interface ParsedRow {
  line: number;
  data: Record<string, string>;
  valid: boolean;
  reason?: string;
}

const HEADERS = [
  "full_name",
  "email",
  "phone",
  "dob",
  "gender",
  "address",
  "school_name",
  "board",
  "current_class",
  "parent_phone_1",
  "parent_phone_2",
  "parent_consent_method",
] as const;

const MAX_ROWS = 100;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    rows.push(row);
    row = [];
  };
  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (c === ",") {
      pushField();
      i++;
      continue;
    }
    if (c === "\n") {
      pushField();
      pushRow();
      i++;
      continue;
    }
    if (c === "\r") {
      pushField();
      pushRow();
      i += text[i + 1] === "\n" ? 2 : 1;
      continue;
    }
    field += c;
    i++;
  }
  if (field.length > 0 || row.length > 0) {
    pushField();
    pushRow();
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

function toRows(text: string): ParsedRow[] {
  const grid = parseCsv(text);
  const headerRow = grid[0];
  if (!headerRow || grid.length < 2) {
    throw new Error("The file needs a header row and at least one student.");
  }
  const header = headerRow.map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  const idx: Record<string, number> = {};
  header.forEach((h, i) => {
    if (!(h in idx)) idx[h] = i;
  });
  if (!("full_name" in idx) || !("email" in idx)) {
    throw new Error('The header row must include "full_name" and "email".');
  }

  const seen = new Set<string>();
  const out: ParsedRow[] = [];
  for (let r = 1; r < grid.length; r++) {
    const cells = grid[r] ?? [];
    const data: Record<string, string> = {};
    for (const key of HEADERS) {
      const i = idx[key];
      const cell = i !== undefined ? cells[i] : undefined;
      data[key] = cell !== undefined ? cell.trim() : "";
    }
    if (Object.values(data).every((v) => v === "")) continue;

    const fullName = data.full_name ?? "";
    const email = data.email ?? "";
    let valid = true;
    let reason: string | undefined;
    const emailKey = email.toLowerCase();
    if (fullName.length < 2) {
      valid = false;
      reason = "Name is missing";
    } else if (!EMAIL_RE.test(email)) {
      valid = false;
      reason = "Invalid email";
    } else if (seen.has(emailKey)) {
      valid = false;
      reason = "Duplicate email in file";
    }
    if (valid) seen.add(emailKey);
    out.push({ line: r + 1, data, valid, reason });
  }
  return out;
}

function csvCell(v: string): string {
  return `"${v.replace(/"/g, '""')}"`;
}

function download(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function ImportClient({ batches }: { batches: Batch[] }) {
  const [batchId, setBatchId] = useState(batches[0]?.id ?? "");
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [parseError, setParseError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const validRows = useMemo(() => rows.filter((r) => r.valid), [rows]);
  const invalidCount = rows.length - validRows.length;
  const willImport = validRows.slice(0, MAX_ROWS);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResult(null);
    setParseError("");
    setRows([]);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        setRows(toRows(String(reader.result ?? "")));
      } catch (err) {
        setParseError(err instanceof Error ? err.message : "Could not read the CSV.");
      }
    };
    reader.onerror = () => setParseError("Could not read the file.");
    reader.readAsText(file);
  }

  async function doImport() {
    if (!batchId || willImport.length === 0) return;
    setSubmitting(true);
    setResult(null);
    try {
      const res = await importStudentsAction({
        batch_id: batchId,
        rows: willImport.map((r) => r.data),
      });
      setResult(res);
    } catch {
      setResult({ error: "The import failed. Please try again." });
    } finally {
      setSubmitting(false);
    }
  }

  function downloadCreds() {
    if (!result?.report) return;
    const lines = [
      "email,temp_password",
      ...result.report.created.map(
        (c) => `${csvCell(c.email)},${csvCell(c.initial_password)}`,
      ),
    ];
    download(lines.join("\r\n"), "new-student-credentials.csv");
  }

  if (result?.report) {
    const { report } = result;
    return (
      <div className="space-y-6">
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900">
            Import complete
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {report.created.length} created · {report.failed.length} failed ·{" "}
            {report.total} attempted.
          </p>
          {report.created.length > 0 ? (
            <div className="mt-4">
              <Button onClick={downloadCreds}>
                Download credentials (CSV)
              </Button>
              <p className="mt-2 text-xs text-slate-500">
                Temp passwords are shown only once — download and distribute now.
                Each student must change their password at first login.
              </p>
            </div>
          ) : null}
        </div>

        {report.failed.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <p className="border-b border-slate-100 px-4 py-3 text-sm font-medium text-slate-700">
              Failed rows
            </p>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-200">
                {report.failed.map((f, i) => (
                  <tr key={`${f.email}-${i}`}>
                    <td className="px-4 py-2 text-slate-700">{f.email}</td>
                    <td className="px-4 py-2 text-red-600">{f.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        <Button
          variant="outline"
          onClick={() => {
            setResult(null);
            setRows([]);
            setFileName("");
          }}
        >
          Import another file
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-slate-900">
          1 · Choose the target batch
        </h2>
        <select
          value={batchId}
          onChange={(e) => setBatchId(e.target.value)}
          className="mt-3 h-9 w-full max-w-sm rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-900"
        >
          {batches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <p className="mt-2 text-xs text-slate-500">
          Every student in this file will be enrolled in this batch.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">
            2 · Upload the CSV
          </h2>
          <button
            type="button"
            onClick={() => download(HEADERS.join(",") + "\r\n", "students-template.csv")}
            className="text-xs font-medium text-blue-600 hover:underline"
          >
            Download template
          </button>
        </div>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={onFile}
          className="mt-3 block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-slate-700"
        />
        <p className="mt-2 text-xs text-slate-500">
          Required columns: <code>full_name</code>, <code>email</code>. Optional:
          phone, dob (YYYY-MM-DD), gender (male/female/other/prefer_not),
          address, school_name, board, current_class, parent_phone_1,
          parent_phone_2, parent_consent_method (verbal/written/form). Up to{" "}
          {MAX_ROWS} students per file.
        </p>
        {fileName ? (
          <p className="mt-2 text-xs text-slate-400">Loaded: {fileName}</p>
        ) : null}
        {parseError ? (
          <p className="mt-2 text-sm text-red-600">{parseError}</p>
        ) : null}
      </div>

      {rows.length > 0 ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="rounded-full bg-emerald-100 px-3 py-0.5 font-medium text-emerald-800">
              {validRows.length} valid
            </span>
            {invalidCount > 0 ? (
              <span className="rounded-full bg-red-100 px-3 py-0.5 font-medium text-red-800">
                {invalidCount} skipped
              </span>
            ) : null}
            {validRows.length > MAX_ROWS ? (
              <span className="text-amber-700">
                Only the first {MAX_ROWS} valid rows will be imported.
              </span>
            ) : null}
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Line</th>
                  <th className="px-4 py-2 font-medium">Name</th>
                  <th className="px-4 py-2 font-medium">Email</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {rows.map((r) => (
                  <tr key={r.line} className={r.valid ? "" : "bg-red-50/40"}>
                    <td className="px-4 py-2 text-slate-400">{r.line}</td>
                    <td className="px-4 py-2 text-slate-700">
                      {r.data.full_name || "—"}
                    </td>
                    <td className="px-4 py-2 text-slate-600">
                      {r.data.email || "—"}
                    </td>
                    <td className="px-4 py-2">
                      {r.valid ? (
                        <span className="text-emerald-700">Ready</span>
                      ) : (
                        <span className="text-red-600">{r.reason}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Button
            onClick={doImport}
            disabled={submitting || willImport.length === 0 || !batchId}
          >
            {submitting
              ? "Importing…"
              : `Import ${willImport.length} student${willImport.length === 1 ? "" : "s"}`}
          </Button>
          {submitting ? (
            <p className="text-xs text-slate-500">
              Creating accounts one by one — this can take up to a minute. Keep
              this tab open.
            </p>
          ) : null}
        </div>
      ) : null}

      {result?.error ? (
        <p className="text-sm text-red-600">{result.error}</p>
      ) : null}
    </div>
  );
}
