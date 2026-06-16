import type { NextConfig } from "next";

// The admin panel performs privileged operations + holds auth/TOTP, so it gets
// the same header posture as apps/web — minus the YouTube/pdf.js allowances it
// doesn't need. 'unsafe-inline'/'unsafe-eval' are required by the Next runtime;
// Supabase REST + Realtime are whitelisted in connect-src; signed Storage URLs
// (https) and data:/blob: (TOTP QR) are allowed in img-src.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://*.supabase.co";

const ContentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  `connect-src 'self' ${SUPABASE_URL} https://*.supabase.co wss://*.supabase.co`,
  "font-src 'self' data:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: ContentSecurityPolicy },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
