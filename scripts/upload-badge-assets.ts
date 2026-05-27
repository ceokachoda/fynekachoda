// Phase 10 CP7 — generate + upload the 11 placeholder badge icons.
//
// ⚠ PLACEHOLDER ART — flat coloured discs with a short white glyph, one per badge
// `code`. Swap for final designed SVGs in Phase 12 polish (just re-run this script
// with new art, or upload over the same paths). Uploads to the private `badge-assets`
// bucket via the SERVICE_ROLE key, at the `icon_path` recorded in public.badges.
//
// Run: pnpm upload:badge-assets

import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(__dirname, "..", "apps", "admin", ".env.local"), override: false });

const SUPABASE_URL = required("NEXT_PUBLIC_SUPABASE_URL");
const SERVICE_KEY = required("SUPABASE_SERVICE_ROLE_KEY");

function required(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`missing env var ${name}`);
    process.exit(1);
  }
  return v;
}

// code → { colour, short white glyph }. All distinct by colour + glyph.
const BADGE_ART: Record<string, { color: string; glyph: string }> = {
  first_quiz: { color: "#16a34a", glyph: "1st" },
  streak_7: { color: "#f97316", glyph: "7" },
  streak_30: { color: "#dc2626", glyph: "30" },
  streak_90: { color: "#eab308", glyph: "90" },
  perfect_week_attendance: { color: "#0d9488", glyph: "100%" },
  topper_of_week: { color: "#f59e0b", glyph: "#1" },
  runner_up_week: { color: "#64748b", glyph: "2/3" },
  quiz_100: { color: "#7c3aed", glyph: "100" },
  mastery_80_subject: { color: "#2563eb", glyph: "80%" },
  early_bird: { color: "#06b6d4", glyph: "AM" },
  comeback: { color: "#6366f1", glyph: "RE" },
};

function fontSize(glyph: string): number {
  if (glyph.length <= 2) return 32;
  if (glyph.length === 3) return 24;
  return 19;
}

function makeSvg(color: string, glyph: string): string {
  const fs = fontSize(glyph);
  const y = 48 + Math.round(fs * 0.34); // baseline ≈ vertical centre
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="96" height="96">
  <circle cx="48" cy="48" r="46" fill="${color}"/>
  <circle cx="48" cy="48" r="46" fill="none" stroke="#ffffff" stroke-opacity="0.45" stroke-width="3"/>
  <text x="48" y="${y}" font-family="Arial, Helvetica, sans-serif" font-size="${fs}" font-weight="700" fill="#ffffff" text-anchor="middle">${glyph}</text>
</svg>`;
}

async function main() {
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: badges, error } = await admin
    .from("badges")
    .select("code, icon_path")
    .order("sort_order");
  if (error || !badges) {
    console.error(`badge lookup failed: ${error?.message}`);
    process.exit(1);
  }

  let uploaded = 0;
  for (const b of badges) {
    const code = b.code as string;
    const iconPath = b.icon_path as string;
    const art = BADGE_ART[code];
    if (!art) {
      console.error(`  SKIP  no art for badge code "${code}"`);
      continue;
    }
    const svg = makeSvg(art.color, art.glyph);
    const { error: upErr } = await admin.storage
      .from("badge-assets")
      .upload(iconPath, Buffer.from(svg, "utf-8"), {
        contentType: "image/svg+xml",
        upsert: true,
      });
    if (upErr) {
      console.error(`  FAIL  ${code} → ${iconPath}: ${upErr.message}`);
      process.exit(1);
    }
    uploaded++;
    console.log(`  OK    ${code.padEnd(24)} → ${iconPath}  (${art.glyph})`);
  }

  console.log(`\nUploaded ${uploaded}/${badges.length} placeholder badge icons to badge-assets.`);
  if (uploaded !== 11) {
    console.error("expected 11 badges — catalogue mismatch");
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
