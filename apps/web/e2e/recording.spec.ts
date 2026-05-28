import { test, expect } from "@playwright/test";
import { loginAsStudent } from "./helpers";

// Phase 4 Track 4A — recording playback. Tolerant of seed state. Full
// speed-change + chat replay sync are validated by the manual test plan §B.

test.describe("Student recording", () => {
  test("Classes tab Recorded segment links to /recording/[id]", async ({
    page,
  }) => {
    await loginAsStudent(page);
    await page.goto("/classes");
    await page.getByRole("button", { name: /^recorded/i }).click();

    const recLinks = page.getByTestId("recording-link");
    const count = await recLinks.count();
    test.skip(count === 0, "No recordings in this environment");

    const href = await recLinks.first().getAttribute("href");
    expect(href).toMatch(/^\/recording\/[a-z0-9-]+/i);

    await recLinks.first().click();
    await page.waitForURL(/\/recording\//);
    // Either the player + speed buttons (recording ready) or the 409
    // "processing" message renders — both are valid end states for this
    // smoke test. We assert the recording header at minimum.
    await expect(page.locator("header")).toContainText(/RECORDING/i, {
      timeout: 10_000,
    });
  });
});
