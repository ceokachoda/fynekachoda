import { describe, expect, it } from "vitest";
import { computeRoleHelpers, type Role } from "@/features/auth/role-helpers";

describe("computeRoleHelpers", () => {
  it("handles an empty role array", () => {
    const h = computeRoleHelpers([]);
    expect(h.isStudent).toBe(false);
    expect(h.isTeacher).toBe(false);
    expect(h.isAdmin).toBe(false);
    expect(h.isMultiRole).toBe(false);
  });

  it("detects a student-only user", () => {
    const h = computeRoleHelpers(["student"]);
    expect(h.isStudent).toBe(true);
    expect(h.isTeacher).toBe(false);
    expect(h.isAdmin).toBe(false);
    expect(h.isMultiRole).toBe(false);
  });

  it("detects a teacher-only user", () => {
    const h = computeRoleHelpers(["teacher"]);
    expect(h.isTeacher).toBe(true);
    expect(h.isStudent).toBe(false);
    expect(h.isMultiRole).toBe(false);
  });

  it("detects a multi-role student+teacher user", () => {
    const h = computeRoleHelpers(["student", "teacher"]);
    expect(h.isStudent).toBe(true);
    expect(h.isTeacher).toBe(true);
    expect(h.isMultiRole).toBe(true);
  });

  it("treats owner_admin and staff_admin as admin", () => {
    expect(computeRoleHelpers(["owner_admin"]).isAdmin).toBe(true);
    expect(computeRoleHelpers(["staff_admin"]).isAdmin).toBe(true);
  });

  it("admin + student is NOT multi-role (only student+teacher is)", () => {
    const h = computeRoleHelpers(["student", "owner_admin"]);
    expect(h.isMultiRole).toBe(false);
    expect(h.isAdmin).toBe(true);
    expect(h.isStudent).toBe(true);
  });

  it("hasRole works for arbitrary roles", () => {
    const h = computeRoleHelpers(["student"]);
    const r: Role = "teacher";
    expect(h.hasRole("student")).toBe(true);
    expect(h.hasRole(r)).toBe(false);
  });
});
