// Stages ALL edge functions to a temp workdir with a clean config.toml, per
// D-170/D-187 (the repo's supabase/config.toml has legacy keys the deploy
// rejects; functions live in apps/functions, not supabase/functions; no global
// CLI / Docker in this env — deploy via `npx supabase`).
//
// Usage:
//   node scripts/stage-functions-deploy.cjs
// then deploy ALL from the printed workdir:
//   npx supabase functions deploy --workdir <WORKDIR> --project-ref orqwyazvcthgxoadfxfv
// or a single fn:
//   npx supabase functions deploy <name> --workdir <WORKDIR> --project-ref orqwyazvcthgxoadfxfv

const fs = require("fs");
const path = require("path");

const src = path.resolve(__dirname, "..", "apps", "functions");
const root = path.join(process.env.LOCALAPPDATA || "/tmp", "Temp", "sb-deploy-web");
const dst = path.join(root, "supabase", "functions");

fs.rmSync(root, { recursive: true, force: true });
fs.mkdirSync(dst, { recursive: true });
// Preserve the two PUBLIC functions' verify_jwt=false (health check + the
// exam-timer `server-time` endpoint). A bulk deploy would otherwise re-enable
// JWT verification on them and break the public callers.
fs.writeFileSync(
  path.join(root, "supabase", "config.toml"),
  [
    'project_id = "fynestudy"',
    "",
    "[functions.health]",
    "verify_jwt = false",
    "",
    "[functions.server-time]",
    "verify_jwt = false",
    "",
  ].join("\n"),
);

const entries = fs
  .readdirSync(src, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name);

for (const f of entries) {
  fs.cpSync(path.join(src, f), path.join(dst, f), { recursive: true });
}

const fnCount = entries.filter((e) => e !== "_shared").length;
console.log(`staged ${fnCount} fns + _shared to ${dst}`);
console.log("WORKDIR=" + root);
