import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-url";

// Only public routes belong in the sitemap — auth-gated pages have no indexable
// value (Phase 5 §G2).
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  return [
    { url: `${base}/login`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/privacy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/terms`, changeFrequency: "yearly", priority: 0.3 },
  ];
}
