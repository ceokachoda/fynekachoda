import { describe, it, expect } from "@jest/globals";
import { computeRoleHelpers } from "./role-helpers";

describe("computeRoleHelpers", () => {
  it("flags student-only correctly", () => {
    const r = computeRoleHelpers(["student"]);
    expect(r.isStudent).toBe(true);
    expect(r.isTeacher).toBe(false);
    expect(r.isAdmin).toBe(false);
    expect(r.isMultiRole).toBe(false);
    expect(r.hasRole("student")).toBe(true);
    expect(r.hasRole("teacher")).toBe(false);
  });

  it("flags teacher-only correctly", () => {
    const r = computeRoleHelpers(["teacher"]);
    expect(r.isStudent).toBe(false);
    expect(r.isTeacher).toBe(true);
    expect(r.isAdmin).toBe(false);
    expect(r.isMultiRole).toBe(false);
  });

  it("flags student + teacher as multi-role", () => {
    const r = computeRoleHelpers(["student", "teacher"]);
    expect(r.isStudent).toBe(true);
    expect(r.isTeacher).toBe(true);
    expect(r.isMultiRole).toBe(true);
    expect(r.isAdmin).toBe(false);
  });

  it("flags owner_admin as admin", () => {
    const r = computeRoleHelpers(["owner_admin"]);
    expect(r.isAdmin).toBe(true);
    expect(r.isStudent).toBe(false);
  });

  it("flags staff_admin as admin", () => {
    const r = computeRoleHelpers(["staff_admin"]);
    expect(r.isAdmin).toBe(true);
  });

  it("supports teacher + staff_admin (common combo)", () => {
    const r = computeRoleHelpers(["teacher", "staff_admin"]);
    expect(r.isTeacher).toBe(true);
    expect(r.isAdmin).toBe(true);
    expect(r.isMultiRole).toBe(false);
  });

  it("treats an empty role list as no-role (no flags set)", () => {
    const r = computeRoleHelpers([]);
    expect(r.isStudent).toBe(false);
    expect(r.isTeacher).toBe(false);
    expect(r.isAdmin).toBe(false);
    expect(r.isMultiRole).toBe(false);
    expect(r.roles).toEqual([]);
  });

  it("preserves the roles array on the result", () => {
    const r = computeRoleHelpers(["student", "teacher"]);
    expect(r.roles).toEqual(["student", "teacher"]);
  });
});
