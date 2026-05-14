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
