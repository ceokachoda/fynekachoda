// Canonical public origin for SEO metadata (metadataBase, robots, sitemap, OG).
//
// Resolution order:
//  1. NEXT_PUBLIC_SITE_URL — set this in Vercel once the custom domain is live.
//  2. VERCEL_PROJECT_PRODUCTION_URL — auto-injected by Vercel (the *.vercel.app
//     production domain), so it "just works" without any config.
//  3. The default web Vercel slug.
const DEFAULT_SITE_URL = "https://fyne-study-web.vercel.app";

export function siteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, "");
  }
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  return DEFAULT_SITE_URL;
}
