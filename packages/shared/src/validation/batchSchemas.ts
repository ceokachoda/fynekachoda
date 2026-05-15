import { z } from "zod";

const BatchName = z.string().trim().min(2).max(120);
const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");
const TimeHHMM = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "expected HH:MM 24h");
const Capacity = z.number().int().min(1).max(10_000);
const Weekday = z.number().int().min(0).max(6);
const TransferReason = z.string().trim().min(3).max(500);

export const CreateBatchInput = z
  .object({
    course_id: z.string().uuid(),
    name: BatchName,
    starts_on: IsoDate,
    ends_on: IsoDate.optional(),
    capacity: Capacity.default(80),
    is_active: z.boolean().default(true),
  })
  .refine(
    (b) => !b.ends_on || b.ends_on >= b.starts_on,
    { message: "ends_on must be on or after starts_on", path: ["ends_on"] },
  );
export type CreateBatchInput = z.infer<typeof CreateBatchInput>;

export const UpdateBatchInput = z
  .object({
    name: BatchName.optional(),
    starts_on: IsoDate.optional(),
    ends_on: IsoDate.nullish(),
    capacity: Capacity.optional(),
    is_active: z.boolean().optional(),
  })
  .refine(
    (b) => !b.starts_on || !b.ends_on || b.ends_on >= b.starts_on,
    { message: "ends_on must be on or after starts_on", path: ["ends_on"] },
  );
export type UpdateBatchInput = z.infer<typeof UpdateBatchInput>;

export const AssignTeacherInput = z.object({
  batch_id: z.string().uuid(),
  teacher_id: z.string().uuid(),
});
export type AssignTeacherInput = z.infer<typeof AssignTeacherInput>;

export const UnassignTeacherInput = AssignTeacherInput;
export type UnassignTeacherInput = z.infer<typeof UnassignTeacherInput>;

export const BatchScheduleRowInput = z
  .object({
    batch_id: z.string().uuid(),
    weekday: Weekday,
    start_time: TimeHHMM,
    end_time: TimeHHMM,
    subject_id: z.string().uuid().optional(),
    is_active: z.boolean().default(true),
  })
  .refine((s) => s.end_time > s.start_time, {
    message: "end_time must be after start_time",
    path: ["end_time"],
  });
export type BatchScheduleRowInput = z.infer<typeof BatchScheduleRowInput>;

export const BatchTransferInput = z.object({
  student_id: z.string().uuid(),
  to_batch_id: z.string().uuid(),
  reason: TransferReason,
});
export type BatchTransferInput = z.infer<typeof BatchTransferInput>;
