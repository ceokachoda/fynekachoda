import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV !== "production",
  cacheOnNavigation: true,
  reloadOnOnline: true,
});

// CSP — broad enough to embed YouTube IFrame + load pdf.js worker as a Blob.
// `frame-src youtube.com` covers the wrapped player (D-173); `worker-src 'self'
// blob:` lets react-pdf spin up its worker from a Blob URL. Inline styles are
// needed for Tailwind/Next; inline scripts for the Next runtime + service
// worker registration.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://*.supabase.co";

const ContentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.youtube.com https://s.ytimg.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https: https://i.ytimg.com",
  `connect-src 'self' ${SUPABASE_URL} https://*.supabase.co wss://*.supabase.co https://www.youtube.com`,
  "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com",
  "worker-src 'self' blob:",
  "font-src 'self' data:",
  "media-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // react-pdf ships ESM that Next 15 / webpack needs help with.
  transpilePackages: ["react-pdf", "pdfjs-dist"],
  compiler: {
    removeConsole: process.env.NODE_ENV === "production" ? { exclude: ["error", "warn"] } : false,
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: ContentSecurityPolicy },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default withSerwist(nextConfig);
