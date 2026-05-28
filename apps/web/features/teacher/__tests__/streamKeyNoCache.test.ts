// Phase 4 Track 4B — security source-scan: the YouTube stream key must NEVER
// be cached in React Query / localStorage / sessionStorage. The
// LiveControlClient is the ONLY surface that receives it (component-local
// useState). A regression that adds it to a query cache or storage would
// open a recoverable secret leak.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry === "node_modules" || entry === "__tests__") continue;
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

describe("stream key — never persisted", () => {
  const roots = [
    resolve(__dirname, "../../../features"),
    resolve(__dirname, "../../../app"),
    resolve(__dirname, "../../../components"),
  ];
  const files = roots.flatMap((r) => walk(r));

  it("only the LiveControlClient references `stream_key` / `streamKey`", () => {
    const offenders: string[] = [];
    for (const path of files) {
      const src = readFileSync(path, "utf8");
      if (/stream_?key/i.test(src)) {
        offenders.push(path.replace(/\\/g, "/"));
      }
    }
    // The mutations hook + LiveControlClient + WrappedYtPlayer integration
    // are the only legitimate references. Anyone else mentioning the key
    // (especially something that caches it) should fail this test.
    const allowed = [
      "/features/teacher/mutations.ts",
      "/app/live-control/[sessionId]/_components/LiveControlClient.tsx",
    ];
    const unexpected = offenders.filter(
      (p) => !allowed.some((a) => p.endsWith(a)),
    );
    expect(unexpected).toEqual([]);
  });

  it("LiveControlClient does NOT pass `streamKey` into React Query or localStorage", () => {
    const path = resolve(
      __dirname,
      "../../../app/live-control/[sessionId]/_components/LiveControlClient.tsx",
    );
    const src = readFileSync(path, "utf8");
    expect(src).not.toMatch(/localStorage[^\n]*streamKey/i);
    expect(src).not.toMatch(/sessionStorage[^\n]*streamKey/i);
    expect(src).not.toMatch(/useQuery[^]*streamKey/);
  });
});
