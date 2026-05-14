import {
  createContext,
  useCallback,
  useContext,
  useEffect,
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
      .select("id, full_name, email, is_active, must_change_password")
      .eq("auth_user_id", s.user.id)
      .maybeSingle();
    if (!au) {
      setAppUser(null);
      setRoles([]);
      return;
    }
    setAppUser(au as AppUser);
    const { data: roleRows } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", au.id);
    setRoles((roleRows ?? []).map((r) => r.role as Role));
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

  return (
    <SessionContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        appUser,
        roles,
        isLoading,
        refresh: init,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSessionContext(): SessionState {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error("useSessionContext must be used inside <SessionProvider>");
  }
  return ctx;
}
