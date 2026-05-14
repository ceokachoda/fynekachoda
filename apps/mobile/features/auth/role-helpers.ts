export type Role = "student" | "teacher" | "staff_admin" | "owner_admin";

export interface RoleHelpers {
  roles: Role[];
  hasRole: (r: Role) => boolean;
  isStudent: boolean;
  isTeacher: boolean;
  isAdmin: boolean;
  isMultiRole: boolean;
}

// Pure derivation. Lives outside useRole.ts so jest can test it without
// pulling in react / supabase-js / react-native.
export function computeRoleHelpers(roles: Role[]): RoleHelpers {
  return {
    roles,
    hasRole: (r) => roles.includes(r),
    isStudent: roles.includes("student"),
    isTeacher: roles.includes("teacher"),
    isAdmin: roles.includes("owner_admin") || roles.includes("staff_admin"),
    isMultiRole: roles.includes("student") && roles.includes("teacher"),
  };
}
