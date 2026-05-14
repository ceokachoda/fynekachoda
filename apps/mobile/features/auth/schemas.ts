import { z } from "zod";

export const EmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Enter your email")
  .email("Enter a valid email");

// Password rules from spec/authentication.md §5:
//   - min 10 chars
//   - at least one upper, one lower, one digit
//   - no spaces
//   - cannot equal email
export function makeNewPasswordSchema(email: string | null) {
  return z
    .string()
    .min(10, "Use at least 10 characters")
    .regex(/[a-z]/, "Include a lowercase letter")
    .regex(/[A-Z]/, "Include an uppercase letter")
    .regex(/\d/, "Include a digit")
    .regex(/^\S+$/, "No spaces allowed")
    .refine(
      (v) => !email || v.toLowerCase() !== email.toLowerCase(),
      "Password cannot match your email",
    );
}

export const LoginSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1, "Password is required"),
});

export type LoginInput = z.infer<typeof LoginSchema>;
