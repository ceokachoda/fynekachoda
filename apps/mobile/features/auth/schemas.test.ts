import { describe, it, expect } from "@jest/globals";
import { EmailSchema, LoginSchema, makeNewPasswordSchema } from "./schemas";

describe("EmailSchema", () => {
  it("accepts a normal email and trims + lowercases it", () => {
    const r = EmailSchema.safeParse("  Foo@Example.COM  ");
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toBe("foo@example.com");
  });

  it("rejects empty input", () => {
    const r = EmailSchema.safeParse("");
    expect(r.success).toBe(false);
  });

  it("rejects a malformed email", () => {
    const r = EmailSchema.safeParse("not-an-email");
    expect(r.success).toBe(false);
  });
});

describe("LoginSchema", () => {
  it("accepts valid credentials", () => {
    const r = LoginSchema.safeParse({
      email: "foo@example.com",
      password: "anything",
    });
    expect(r.success).toBe(true);
  });

  it("rejects empty password", () => {
    const r = LoginSchema.safeParse({ email: "foo@example.com", password: "" });
    expect(r.success).toBe(false);
  });

  it("rejects bad email even if password is set", () => {
    const r = LoginSchema.safeParse({ email: "not-an-email", password: "x" });
    expect(r.success).toBe(false);
  });
});

describe("makeNewPasswordSchema", () => {
  const schema = makeNewPasswordSchema("user@example.com");

  it("accepts a strong password", () => {
    const r = schema.safeParse("Strong1Password");
    expect(r.success).toBe(true);
  });

  it("rejects passwords shorter than 10 chars", () => {
    const r = schema.safeParse("Ab1cdefg"); // 8 chars
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.message).toMatch(/10 characters/);
    }
  });

  it("rejects passwords without a lowercase letter", () => {
    const r = schema.safeParse("STRONG1PASSWORD");
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.message).toMatch(/lowercase/);
    }
  });

  it("rejects passwords without an uppercase letter", () => {
    const r = schema.safeParse("strong1password");
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.message).toMatch(/uppercase/);
    }
  });

  it("rejects passwords without a digit", () => {
    const r = schema.safeParse("StrongPassword");
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.message).toMatch(/digit/);
    }
  });

  it("rejects passwords containing spaces", () => {
    const r = schema.safeParse("Strong 1Password");
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.message).toMatch(/spaces/i);
    }
  });

  it("rejects passwords matching the user's email (case-insensitive)", () => {
    // The candidate must pass length/case/digit/space rules so the
    // email-match refine is the only failing rule. Choose an email that
    // already satisfies all char-class rules and feed back a different-cased
    // version of it.
    const emailLike = "Strong1Password@example.com";
    const candidate = "strong1Password@Example.com";
    const passwordLikeSchema = makeNewPasswordSchema(emailLike);
    const r = passwordLikeSchema.safeParse(candidate);
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.message).toMatch(/cannot match your email/i);
    }
  });

  it("allows email-match check to be skipped when email is null", () => {
    const noEmailSchema = makeNewPasswordSchema(null);
    const r = noEmailSchema.safeParse("Strong1Password");
    expect(r.success).toBe(true);
  });
});
