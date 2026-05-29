import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { Role } from "./role-helpers";

export type { Role };

export interface AppUser {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  dob: string | null;
  is_active: boolean;
  must_change_password: boolean;
}

export interface SessionState {
  session: Session | null;
  user: User | null;
  appUser: AppUser | null;
  roles: Role[];
  isLoading: boolean;
  refresh: () => Promise<void>;
}

const SessionContext = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadProfile = useCallback(async (s: Session | null) => {
    if (!s) {
      setAppUser(null);
      setRoles([]);
      return;
    }
    const { data: au } = await supabase
      .from("app_users")
      .select("id, full_name, email, phone, dob, is_active, must_change_password")
      .eq("auth_user_id", s.user.id)
      .maybeSingle();
    if (!au) {
      setAppUser(null);
      setRoles([]);
      return;
    }
    const { data: roleRows } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", au.id);
    // Commit profile + roles together (no await between the setStates, so React
    // batches them into one render). Consumers must never observe appUser set
    // while roles is still [] — a valid student/teacher would mis-route to the
    // no-role trapdoor for a frame during sign-in.
    setRoles((roleRows ?? []).map((r) => r.role as Role));
    setAppUser(au as AppUser);
  }, []);

  const init = useCallback(async () => {
    setIsLoading(true);
    const { data } = await supabase.auth.getSession();
    setSession(data.session);
    await loadProfile(data.session);
    setIsLoading(false);
  }, [loadProfile]);

  useEffect(() => {
    let active = true;
    init();
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, s) => {
      if (!active) return;
      setSession(s);
      await loadProfile(s);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [init, loadProfile]);

  // Memoize the context value so a change to any single field doesn't hand
  // consumers a brand-new object identity for the unrelated fields, and so the
  // provider never re-renders the whole app tree with a fresh literal.
  const value = useMemo<SessionState>(
    () => ({
      session,
      user: session?.user ?? null,
      appUser,
      roles,
      isLoading,
      refresh: init,
    }),
    [session, appUser, roles, isLoading, init],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSessionContext(): SessionState {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error("useSessionContext must be used inside <SessionProvider>");
  }
  return ctx;
}
