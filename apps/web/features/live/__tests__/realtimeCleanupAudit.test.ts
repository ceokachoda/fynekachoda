// Phase 4 Track 4A — guarantees every `supabase.channel(...)` call in our
// live + chat (and Track 4B teacher) feature hooks has a matching
// `supabase.removeChannel(...)` in cleanup. Ghost realtime subscriptions are
// a known mobile foot-gun; this source-scan keeps the web mirror honest.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOTS = [
  resolve(__dirname, "../../live"),
  resolve(__dirname, "../../chat"),
  resolve(__dirname, "../../teacher"),
  resolve(__dirname, "../../attendance"),
];

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry === "__tests__" || entry === "node_modules") continue;
    const full = join(dir, entry);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) walk(full, out);
    else if (st.isFile() && (entry.endsWith(".ts") || entry.endsWith(".tsx"))) {
      out.push(full);
    }
  }
  return out;
}

function stripCommentsAndStrings(source: string): string {
  // Drop block comments, line comments, then string/template literals.
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "")
    .replace(/`(?:\\.|[^`\\])*`/g, '""')
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/'(?:\\.|[^'\\])*'/g, "''");
}

describe("realtime channel cleanup audit (features/{live,chat,teacher,attendance})", () => {
  const files = ROOTS.flatMap((root) => walk(root));

  it("scans at least the Track 4A files we expect", () => {
    const names = files.map((p) => p.replace(/\\/g, "/"));
    // Track 4A: at minimum these three must be picked up.
    expect(names.some((p) => p.endsWith("features/live/useRaiseHand.ts"))).toBe(
      true,
    );
    expect(
      names.some((p) => p.endsWith("features/live/useSessionState.ts")),
    ).toBe(true);
    expect(
      names.some((p) => p.endsWith("features/chat/useChatChannel.ts")),
    ).toBe(true);
  });

  it.each(files)("%s — channel(...) and removeChannel(...) counts match", (path) => {
    const raw = readFileSync(path, "utf8");
    const code = stripCommentsAndStrings(raw);
    const channelCalls = (code.match(/\.channel\s*\(/g) ?? []).length;
    const removeCalls = (code.match(/\.removeChannel\s*\(/g) ?? []).length;
    expect(
      channelCalls,
      `[${path}] supabase.channel() calls = ${channelCalls}, removeChannel() = ${removeCalls}`,
    ).toBe(removeCalls);
  });
});
