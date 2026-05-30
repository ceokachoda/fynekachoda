"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  computeRoleHelpers,
  type Role,
  type RoleHelpers,
} from "./role-helpers";

export type { Role, RoleHelpers };

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
  helpers: RoleHelpers;
  isLoading: boolean;
  refresh: () => Promise<void>;
}

const SessionContext = createContext<SessionState | null>(null);

interface SessionProviderProps {
  children: ReactNode;
  /** Optional initial session state from the Server Component to skip the first round-trip. */
  initial?: {
    appUser: AppUser;
    roles: Role[];
  };
}

export function SessionProvider({ children, initial }: SessionProviderProps) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(initial?.appUser ?? null);
  const [roles, setRoles] = useState<Role[]>(initial?.roles ?? []);
  const [isLoading, setIsLoading] = useState(!initial);

  const loadProfile = useCallback(
    async (s: Session | null) => {
      if (!s) {
        setAppUser(null);
        setRoles([]);
        return;
      }
      const { data: au, error } = await supabase
        .from("app_users")
        .select("id, full_name, email, phone, dob, is_active, must_change_password")
        .eq("auth_user_id", s.user.id)
        .maybeSingle();
      // A transient RLS / not-ready hiccup must NOT blank a profile we already
      // have (e.g. one hydrated from the server). The server already validated
      // this user in loadWebSession, so keep the current value and let a later
      // auth event refresh it. Only an explicit sign-out (s === null, above)
      // clears the profile.
      if (error || !au) return;
      const { data: roleRows } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", au.id);
      // Commit roles + appUser together so consumers never observe appUser set
      // while roles is still [] (mobile lesson, project_auth-client-timeouts).
      const rows = (roleRows ?? []) as Array<{ role: Role }>;
      setRoles(rows.map((r) => r.role));
      setAppUser(au as AppUser);
    },
    [supabase],
  );

  const init = useCallback(async () => {
    // Don't flip back to a loading state when we were hydrated from the server —
    // the UI is already populated and this is just a background confirmation.
    const { data } = await supabase.auth.getSession();
    setSession(data.session);
    await loadProfile(data.session);
    setIsLoading(false);
  }, [supabase, loadProfile]);

  useEffect(() => {
    let active = true;
    init();
    const { data: sub } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, s: Session | null) => {
        if (!active) return;
        setSession(s);
        // NEVER await a Supabase call inside this callback. It fires while the
        // gotrue auth lock (navigator.locks, browser-only) is held; a nested
        // client query re-enters that non-reentrant lock and DEADLOCKS — after
        // which every client query (the dashboard RPC, schedule, my-batch, …)
        // hangs forever and the UI is stuck on skeletons. Defer the profile
        // load outside the callback so the lock is released first. (Supabase
        // documents this exact footgun; Node has no navigator.locks, which is
        // why it only reproduces in the browser.)
        setTimeout(() => {
          if (active) void loadProfile(s);
        }, 0);
      },
    );
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [init, loadProfile, supabase]);

  const helpers = useMemo(() => computeRoleHelpers(roles), [roles]);

  const value: SessionState = {
    session,
    user: session?.user ?? null,
    appUser,
    roles,
    helpers,
    isLoading,
    refresh: init,
  };

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionState {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error("useSession must be used inside <SessionProvider>");
  }
  return ctx;
}

export function useRole(): RoleHelpers {
  return useSession().helpers;
}
