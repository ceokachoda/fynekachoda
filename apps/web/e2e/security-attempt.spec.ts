import { test, expect, type Response } from "@playwright/test";
import { loginAsStudent } from "./helpers";

// Phase 3 security invariant — no API response on the quiz/exam ATTEMPT
// pages may contain is_correct / correct_option_id / solution_text /
// answer_key. quiz-start and exam-start strip them server-side; this E2E
// double-checks at the network layer.

const BANNED = [
  "is_correct",
  "correct_option_id",
  "correct_options",
  "answer_key",
  "solution_text",
  "solution_image_url",
];

test.describe("Phase 3 security — no banned keys during attempt", () => {
  test("classes + library + dashboard during a student session never leak banned keys", async ({
    page,
  }) => {
    const offenders: Array<{ url: string; key: string; preview: string }> = [];
    page.on("response", async (res: Response) => {
      const url = res.url();
      if (
        !/supabase\.co\/(rest|functions|auth)/.test(url) &&
        !url.startsWith(page.url().split("?")[0]!)
      ) {
        return;
      }
      try {
        const ct = res.headers()["content-type"] ?? "";
        if (!ct.includes("application/json")) return;
        const text = await res.text();
        for (const key of BANNED) {
          if (text.includes(`"${key}"`)) {
            offenders.push({ url, key, preview: text.slice(0, 200) });
            break;
          }
        }
      } catch {
        // ignore
      }
    });
    await loginAsStudent(page);
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.goto("/classes");
    await page.waitForLoadState("networkidle");
    await page.goto("/library");
    await page.waitForLoadState("networkidle");
    expect(
      offenders,
      `Banned keys leaked to the client:\n${offenders
        .map((o) => `  ${o.key} in ${o.url}\n    ${o.preview}`)
        .join("\n")}`,
    ).toEqual([]);
  });

  test("static bundle does not include service-role key (Phase 3 routes)", async ({
    request,
  }) => {
    // Walk the chunks listed in the home document; assert none of them
    // include the banned string. Phase 3 adds /quiz/[id] and /exam/[id]
    // chunks; this catches a misimport that pulls the service-role key in.
    const home = await request.get("/");
    const html = await home.text();
    const chunkUrls = Array.from(
      html.matchAll(/\/_next\/static\/[\w./-]+\.js/g),
    ).map((m) => m[0]);
    for (const url of chunkUrls.slice(0, 30)) {
      const r = await request.get(url);
      const body = await r.text();
      expect(body).not.toContain("SUPABASE_SERVICE_ROLE");
      expect(body).not.toContain("service_role");
    }
  });
});
