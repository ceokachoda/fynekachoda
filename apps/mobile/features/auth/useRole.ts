import { useMemo } from "react";
import { useSession } from "./useSession";
import { computeRoleHelpers, type RoleHelpers } from "./role-helpers";

export type { Role, RoleHelpers } from "./role-helpers";

export function useRole(): RoleHelpers {
  const { roles } = useSession();
  return useMemo<RoleHelpers>(() => computeRoleHelpers(roles), [roles]);
}
