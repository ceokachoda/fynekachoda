import { z } from "npm:zod@3.24.0";

export const RoleSchema = z.enum([
  "student",
  "teacher",
  "staff_admin",
  "owner_admin",
]);
export type Role = z.infer<typeof RoleSchema>;

const Email = z.string().email().toLowerCase().trim();
const Phone = z.string().regex(/^\+?[0-9\s\-()]{7,20}$/);
const ConsentMethod = z.enum(["verbal", "written", "form"]);
const Gender = z.enum(["male", "female", "other", "prefer_not"]);
const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const FullName = z.string().trim().min(2).max(100);

export const BootstrapInputSchema = z.discriminatedUnion("role", [
  z.object({
    role: z.literal("student"),
    full_name: FullName,
    email: Email,
    phone: Phone.optional(),
    dob: IsoDate.optional(),
    gender: Gender.optional(),
    parent_phone_1: Phone.optional(),
    parent_phone_2: Phone.optional(),
    school_name: z.string().trim().max(200).optional(),
    board: z.string().trim().max(50).optional(),
    current_class: z.string().trim().max(50).optional(),
    address: z.string().trim().max(500).optional(),
    parent_consent_method: ConsentMethod.optional(),
    batch_id: z.string().uuid().optional(),
  }),
  z.object({
    role: z.literal("teacher"),
    full_name: FullName,
    email: Email,
    phone: Phone.optional(),
    subjects: z.array(z.string().trim().min(1).max(50)).max(20).default([]),
    bio: z.string().trim().max(2000).optional(),
  }),
  z.object({
    role: z.literal("staff_admin"),
    full_name: FullName,
    email: Email,
    phone: Phone.optional(),
  }),
  z.object({
    role: z.literal("owner_admin"),
    full_name: FullName,
    email: Email,
    phone: Phone.optional(),
  }),
]);
export type BootstrapInput = z.infer<typeof BootstrapInputSchema>;

export const SuspendInputSchema = z.object({
  user_id: z.string().uuid(),
  mode: z.enum(["suspend", "unsuspend"]),
  reason: z.string().trim().min(3).max(500).optional(),
});

export const ForceResetInputSchema = z.object({
  user_id: z.string().uuid(),
});

export const ChangeOwnPasswordInputSchema = z.object({
  new_password: z
    .string()
    .min(10, "Use at least 10 characters")
    .max(200)
    .regex(/[a-z]/, "Include a lowercase letter")
    .regex(/[A-Z]/, "Include an uppercase letter")
    .regex(/\d/, "Include a digit")
    .regex(/^\S+$/, "No spaces allowed"),
});
export type ChangeOwnPasswordInput = z.infer<typeof ChangeOwnPasswordInputSchema>;

// Recovery codes are displayed in XXXXX-XXXXX form (10 chars + hyphen).
// We accept any number of hyphens / whitespace on input — normalised before
// hashing — so users can paste with or without dashes.
const RECOVERY_CODE_ALPHA = "abcdefghjkmnpqrstuvwxyz23456789"; // no 0/1/i/l/o
export const RECOVERY_CODE_LENGTH = 10;
export const RECOVERY_CODE_ALPHABET = RECOVERY_CODE_ALPHA;
export const RECOVERY_CODE_BATCH_SIZE = 10;

export const ConsumeRecoveryCodeInputSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "Enter a recovery code"),
});
export type ConsumeRecoveryCodeInput = z.infer<typeof ConsumeRecoveryCodeInputSchema>;

export const QrSignInputSchema = z.object({
  session_id: z.string().uuid(),
});
export type QrSignInput = z.infer<typeof QrSignInputSchema>;

export const QrVerifyInputSchema = z.object({
  qr_payload: z.string().min(20).max(4000),
  session_id: z.string().uuid(),
});
export type QrVerifyInput = z.infer<typeof QrVerifyInputSchema>;

export const AttendanceCorrectInputSchema = z.object({
  attendance_id: z.string().uuid(),
  new_status: z.enum(["present", "late", "absent"]),
  reason: z.string().trim().min(3).max(500),
});
export type AttendanceCorrectInput = z.infer<typeof AttendanceCorrectInputSchema>;

export const AttendanceBulkMarkInputSchema = z.object({
  session_id: z.string().uuid(),
  mark_remaining: z.enum(["present", "absent"]),
});
export type AttendanceBulkMarkInput = z.infer<typeof AttendanceBulkMarkInputSchema>;

export const AttendanceManualMarkInputSchema = z.object({
  session_id: z.string().uuid(),
  student_id: z.string().uuid(),
  status: z.enum(["present", "late", "absent"]),
});
export type AttendanceManualMarkInput = z.infer<typeof AttendanceManualMarkInputSchema>;

export const AttendanceUnmarkInputSchema = z.object({
  session_id: z.string().uuid(),
  student_id: z.string().uuid(),
});
export type AttendanceUnmarkInput = z.infer<typeof AttendanceUnmarkInputSchema>;

export const SessionCreateAdHocInputSchema = z
  .object({
    batch_id: z.string().uuid(),
    subject_id: z.string().uuid().optional(),
    scheduled_start: z.string().datetime(),
    scheduled_end: z.string().datetime(),
    is_live_class: z.boolean().default(false),
  })
  .refine(
    (s) => new Date(s.scheduled_end).getTime() > new Date(s.scheduled_start).getTime(),
    {
      message: "scheduled_end must be after scheduled_start",
      path: ["scheduled_end"],
    },
  );
export type SessionCreateAdHocInput = z.infer<typeof SessionCreateAdHocInputSchema>;

export const BatchTransferInputSchema = z.object({
  student_id: z.string().uuid(),
  to_batch_id: z.string().uuid(),
  reason: z.string().trim().min(3).max(500),
});
export type BatchTransferInput = z.infer<typeof BatchTransferInputSchema>;

const CurriculumCode = z
  .string()
  .trim()
  .min(2)
  .max(30)
  .regex(/^[A-Z][A-Z0-9_]*$/);
const CurriculumName = z.string().trim().min(2).max(120);
const NodeName = z.string().trim().min(1).max(120);
const SortOrder = z.number().int().min(0).max(10_000);

export const CurriculumMutateInputSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("create_course"),
    payload: z.object({
      code: CurriculumCode,
      name: CurriculumName,
      description: z.string().trim().max(2000).optional(),
      is_active: z.boolean().default(true),
    }),
  }),
  z.object({
    op: z.literal("update_course"),
    id: z.string().uuid(),
    patch: z
      .object({
        name: CurriculumName.optional(),
        description: z.string().trim().max(2000).nullish(),
        is_active: z.boolean().optional(),
      })
      .refine((p) => Object.keys(p).length > 0, "empty patch"),
  }),
  z.object({ op: z.literal("delete_course"), id: z.string().uuid() }),

  z.object({
    op: z.literal("create_subject"),
    payload: z.object({
      course_id: z.string().uuid(),
      name: NodeName,
      sort_order: SortOrder.default(0),
    }),
  }),
  z.object({
    op: z.literal("update_subject"),
    id: z.string().uuid(),
    patch: z
      .object({ name: NodeName.optional(), sort_order: SortOrder.optional() })
      .refine((p) => Object.keys(p).length > 0, "empty patch"),
  }),
  z.object({ op: z.literal("delete_subject"), id: z.string().uuid() }),

  z.object({
    op: z.literal("create_chapter"),
    payload: z.object({
      subject_id: z.string().uuid(),
      name: NodeName,
      sort_order: SortOrder.default(0),
    }),
  }),
  z.object({
    op: z.literal("update_chapter"),
    id: z.string().uuid(),
    patch: z
      .object({ name: NodeName.optional(), sort_order: SortOrder.optional() })
      .refine((p) => Object.keys(p).length > 0, "empty patch"),
  }),
  z.object({ op: z.literal("delete_chapter"), id: z.string().uuid() }),

  z.object({
    op: z.literal("create_topic"),
    payload: z.object({
      chapter_id: z.string().uuid(),
      name: NodeName,
      sort_order: SortOrder.default(0),
    }),
  }),
  z.object({
    op: z.literal("update_topic"),
    id: z.string().uuid(),
    patch: z
      .object({ name: NodeName.optional(), sort_order: SortOrder.optional() })
      .refine((p) => Object.keys(p).length > 0, "empty patch"),
  }),
  z.object({ op: z.literal("delete_topic"), id: z.string().uuid() }),
]);
export type CurriculumMutateInput = z.infer<typeof CurriculumMutateInputSchema>;

const BatchName = z.string().trim().min(2).max(120);
const Capacity = z.number().int().min(1).max(10_000);
const Weekday = z.number().int().min(0).max(6);
const TimeHHMM = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

export const ContentKindSchema = z.enum(["video", "pdf", "note"]);
export type ContentKind = z.infer<typeof ContentKindSchema>;

export const PDF_MAX_BYTES = 50 * 1024 * 1024;
export const PDF_ALLOWED_MIME = ["application/pdf"] as const;

export const ContentPresignUploadInputSchema = z.object({
  kind: z.enum(["pdf", "note"]),
  topic_id: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  batch_id: z.string().uuid().optional(),
  content_size_bytes: z.number().int().positive().max(PDF_MAX_BYTES),
  mime_type: z.enum(["application/pdf"]),
});
export type ContentPresignUploadInput = z.infer<
  typeof ContentPresignUploadInputSchema
>;

export const ContentFinalizeInputSchema = z.object({
  kind: z.enum(["pdf", "note"]),
  topic_id: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
  batch_id: z.string().uuid().optional(),
  file_path: z.string().min(8).max(500),
  file_size_bytes: z.number().int().positive().max(PDF_MAX_BYTES).optional(),
  mime_type: z.enum(["application/pdf"]).optional(),
});
export type ContentFinalizeInput = z.infer<typeof ContentFinalizeInputSchema>;

export const ContentCreateVideoInputSchema = z.object({
  yt_url_or_id: z.string().trim().min(8).max(500),
  topic_id: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
  batch_id: z.string().uuid().optional(),
});
export type ContentCreateVideoInput = z.infer<
  typeof ContentCreateVideoInputSchema
>;

export const ContentTogglePublishInputSchema = z.object({
  content_id: z.string().uuid(),
  is_published: z.boolean(),
});
export type ContentTogglePublishInput = z.infer<
  typeof ContentTogglePublishInputSchema
>;

export const ContentPromoteCoursewideInputSchema = z.object({
  content_id: z.string().uuid(),
  promote: z.boolean(),
  batch_id: z.string().uuid().optional(),
});
export type ContentPromoteCoursewideInput = z.infer<
  typeof ContentPromoteCoursewideInputSchema
>;

export const YtPlaybackSignInputSchema = z.object({
  content_id: z.string().uuid(),
});
export type YtPlaybackSignInput = z.infer<typeof YtPlaybackSignInputSchema>;

export const YtThumbSignInputSchema = z.object({
  content_id: z.string().uuid(),
});
export type YtThumbSignInput = z.infer<typeof YtThumbSignInputSchema>;

export const ContentPdfSignInputSchema = z.object({
  content_id: z.string().uuid(),
  // Optional: admin previews use admin=true to bypass the published check.
  // (Caller is still required to be admin server-side.)
});
export type ContentPdfSignInput = z.infer<typeof ContentPdfSignInputSchema>;

export const ContentDeleteInputSchema = z.object({
  content_id: z.string().uuid(),
});
export type ContentDeleteInput = z.infer<typeof ContentDeleteInputSchema>;

export const BatchMutateInputSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("create_batch"),
    payload: z
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
      ),
  }),
  z.object({
    op: z.literal("update_batch"),
    id: z.string().uuid(),
    patch: z
      .object({
        name: BatchName.optional(),
        starts_on: IsoDate.optional(),
        ends_on: IsoDate.nullish(),
        capacity: Capacity.optional(),
        is_active: z.boolean().optional(),
      })
      .refine((p) => Object.keys(p).length > 0, "empty patch"),
  }),
  z.object({ op: z.literal("delete_batch"), id: z.string().uuid() }),
  z.object({
    op: z.literal("assign_teacher"),
    batch_id: z.string().uuid(),
    teacher_id: z.string().uuid(),
  }),
  z.object({
    op: z.literal("unassign_teacher"),
    batch_id: z.string().uuid(),
    teacher_id: z.string().uuid(),
  }),
  z.object({
    op: z.literal("create_schedule_row"),
    payload: z
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
      }),
  }),
  z.object({ op: z.literal("delete_schedule_row"), id: z.string().uuid() }),
]);
export type BatchMutateInput = z.infer<typeof BatchMutateInputSchema>;
