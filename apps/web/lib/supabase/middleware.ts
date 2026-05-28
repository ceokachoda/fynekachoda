import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";

// Returns the Supabase client (configured for the middleware request/response
// cookie cycle) AND the response object the caller must return — Supabase
// needs to attach refreshed cookies to that response object.
export function createMiddlewareSupabase(req: NextRequest) {
  const response = NextResponse.next({ request: req });

  const supabase = createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          req.cookies.set(name, value);
        }
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  return { supabase, response };
}
