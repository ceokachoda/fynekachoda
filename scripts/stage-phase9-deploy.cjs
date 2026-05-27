// Stages Phase 9 edge fns to %LOCALAPPDATA%\Temp\sb-deploy-phase9\
// per D-170/D-187 (Supabase CLI needs a clean config.toml without legacy keys;
// no global CLI in this env — deploy via `npx supabase`).
//
// After staging, deploy each from the staged workdir, e.g.:
//   npx supabase functions deploy yt-broadcast-create \
//     --workdir <printed path> --project-ref orqwyazvcthgxoadfxfv

const fs = require("fs");
const path = require("path");

const src = path.resolve(__dirname, "..", "apps", "functions");
const root = path.join(process.env.LOCALAPPDATA, "Temp", "sb-deploy-phase9");
const dst = path.join(root, "supabase", "functions");

fs.rmSync(root, { recursive: true, force: true });
fs.mkdirSync(dst, { recursive: true });
fs.writeFileSync(
  path.join(root, "supabase", "config.toml"),
  'project_id = "fynestudy"\n',
);

const fns = [
  "_shared",
  "yt-broadcast-create",
  "yt-broadcast-golive",
  "yt-broadcast-stop",
  "yt-playback-sign",
  "chat-delete",
  "chat-ban",
];
for (const f of fns) {
  fs.cpSync(path.join(src, f), path.join(dst, f), { recursive: true });
}
console.log("staged", fns.length - 1, "fns + _shared to", dst);
console.log("WORKDIR=" + root);
