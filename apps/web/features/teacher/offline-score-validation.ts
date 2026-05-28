// Phase 4 Track 4B — pure validation for the offline-scores form. Pulled out
// so we can unit-test without rendering anything.

import { z } from "zod";

export const offlineScoreFormSchema = z
  .object({
    batchId: z.string().uuid("Pick a batch."),
    testName: z.string().min(1, "Test name is required.").max(120),
    testDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD."),
    maxScore: z
      .number()
      .gt(0, "Max score must be > 0.")
      .lte(1000, "Max score must be ≤ 1000."),
    subjectId: z.string().uuid().nullable(),
  })
  .strict();

export type OfflineScoreForm = z.infer<typeof offlineScoreFormSchema>;

export interface ScoreEntry {
  student_id: string;
  score: number;
  notes?: string;
}

export interface ValidatedEntries {
  ok: boolean;
  entries: ScoreEntry[];
  errors: string[];
}

export function validateScoreEntries(
  rosterIds: string[],
  scoresRaw: Record<string, string>,
  notesRaw: Record<string, string>,
  maxScore: number,
): ValidatedEntries {
  const entries: ScoreEntry[] = [];
  const errors: string[] = [];
  for (const studentId of rosterIds) {
    const raw = scoresRaw[studentId];
    if (raw === undefined || raw === "") continue;
    const n = Number.parseFloat(raw);
    if (!Number.isFinite(n)) {
      errors.push(`Score for ${studentId} isn't a number.`);
      continue;
    }
    if (n < 0 || n > maxScore) {
      errors.push(`Score for ${studentId} is outside [0, ${maxScore}].`);
      continue;
    }
    const note = notesRaw[studentId]?.trim();
    entries.push({
      student_id: studentId,
      score: n,
      ...(note ? { notes: note } : {}),
    });
  }
  return { ok: errors.length === 0, entries, errors };
}
