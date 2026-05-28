import { test, expect, type Response } from "@playwright/test";
import { loginAsStudent } from "./helpers";

// Banned keys that MUST NOT appear in any client-bound API response while a
// student browses the Phase 2 surfaces. `is_correct` / `correct_option_id` /
// `solution_*` belong to the quiz/exam attempt path which lands in Phase 3
// — even the discovery surfaces (classes shell, library) must not leak them.
const BANNED = [
  "is_correct",
  "correct_option_id",
  "correct_options",
  "answer_key",
  "solution_text",
  "solution_image_url",
  "service_role",
];

test.describe("Security — no banned keys leak to the client", () => {
  test("dashboard + classes + library do not return is_correct / answer_key / service_role", async ({
    page,
  }) => {
    const offenders: Array<{ url: string; key: string; preview: string }> = [];
    page.on("response", async (res: Response) => {
      // Only inspect responses that look like JSON payloads from our backend.
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
            offenders.push({
              url,
              key,
              preview: text.slice(0, 160),
            });
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
      `Banned keys leaked to the client:\n${offenders.map((o) => `  ${o.key} in ${o.url}\n    ${o.preview}`).join("\n")}`,
    ).toEqual([]);
  });

  test("static bundle does not include the service-role key", async ({ request }) => {
    // Walk the chunks listed in the home document; assert none of them
    // include the banned string. This is a defense-in-depth check on top of
    // build-time greps.
    const home = await request.get("/");
    const html = await home.text();
    const chunkUrls = Array.from(
      html.matchAll(/\/_next\/static\/[\w./-]+\.js/g),
    ).map((m) => m[0]);
    for (const url of chunkUrls.slice(0, 20)) {
      const r = await request.get(url);
      const body = await r.text();
      expect(body).not.toContain("SUPABASE_SERVICE_ROLE");
      expect(body).not.toContain("service_role");
    }
  });
});
