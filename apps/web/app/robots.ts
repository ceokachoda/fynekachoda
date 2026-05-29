import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-url";

// Only the truly public pages should be indexable. Everything else requires a
// login (a crawler can't reach it anyway) — disallow `/` and explicitly allow
// the public marketing/legal pages so any future auth-gated route is excluded
// by default (Phase 5 §G2).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        disallow: ["/"],
        allow: ["/login", "/privacy", "/terms"],
      },
    ],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
