// CORS: allowlisted-origin reflection.
//
// Spec/security.md §12 says: "Supabase configured with allowed origins = admin
// app domain + Expo dev URLs. No `*`." We honor that here. Unknown origins get
// no `Access-Control-Allow-Origin` header and the browser will reject the
// response — which is exactly what we want.

const ALLOWED_ORIGINS: Array<RegExp | string> = [
  "https://admin-kohl-sigma.vercel.app",
  /^https:\/\/admin-[a-z0-9-]+\.vercel\.app$/,
  /^http:\/\/localhost:\d+$/,
  /^http:\/\/127\.0\.0\.1:\d+$/,
  /^http:\/\/192\.168\.\d+\.\d+:\d+$/,
  /^http:\/\/10\.\d+\.\d+\.\d+:\d+$/,
];

function isAllowed(origin: string): boolean {
  return ALLOWED_ORIGINS.some((p) =>
    typeof p === "string" ? p === origin : p.test(origin)
  );
}

export function corsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "Authorization, Content-Type, x-client-info, apikey",
    "Access-Control-Max-Age": "86400",
  };
  if (origin && isAllowed(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

export function handlePreflight(req: Request): Response | null {
  if (req.method !== "OPTIONS") return null;
  return new Response(null, {
    status: 204,
    headers: corsHeaders(req.headers.get("Origin")),
  });
}
