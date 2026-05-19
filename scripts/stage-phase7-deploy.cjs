// Stages Phase 7 edge fns to %LOCALAPPDATA%\Temp\sb-deploy-phase7\
// per D-170 (Supabase CLI needs a clean config.toml).

const fs = require("fs");
const path = require("path");

const src = path.resolve(__dirname, "..", "apps", "functions");
const root = path.join(process.env.LOCALAPPDATA, "Temp", "sb-deploy-phase7");
const dst = path.join(root, "supabase", "functions");

fs.rmSync(root, { recursive: true, force: true });
fs.mkdirSync(dst, { recursive: true });
fs.writeFileSync(
  path.join(root, "supabase", "config.toml"),
  'project_id = "fynestudy"\n',
);

const fns = [
  "_shared",
  "server-time",
  "exam-start",
  "exam-tab-switch",
  "exam-submit",
  "exam-release-results",
  "exam-regrade",
  "offline-score-upsert",
  "exam-attempt-result",
  "exam-admin-mutate",
];
for (const f of fns) {
  fs.cpSync(path.join(src, f), path.join(dst, f), { recursive: true });
}
console.log("staged", fns.length - 1, "fns + _shared to", dst);
