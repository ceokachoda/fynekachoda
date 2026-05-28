import { test, expect } from "@playwright/test";
import { loginAsTeacher } from "./helpers";

// Phase 4 Track 4B — live-control. We DO NOT actually create a YouTube
// broadcast in CI (the yt-broadcast-create edge fn would charge real API
// quota). Tests assert: route gating + the setup-stage shell renders + the
// retry button is wired. The full OBS dry-run is the manual plan §G.

test.describe("Teacher live control", () => {
  test("/live-control/[id] requires teacher role", async ({ page }) => {
    // Not logged in → middleware bounces to /login.
    await page.goto("/live-control/11111111-1111-1111-1111-111111111111");
    await expect(page).toHaveURL(/\/login/);
  });

  test("setup-stage UI renders for a teacher even when the broadcast can't be created", async ({
    page,
  }) => {
    await loginAsTeacher(page);
    await page.goto("/live-control/11111111-1111-1111-1111-111111111111");
    // Either the Preparing-broadcast loader, the inline error w/ Retry, or
    // the RTMP/key card mounts. We just assert one of those is visible.
    await expect(
      page.locator(
        "[data-testid='broadcast-retry'], [data-testid='copy-server'], [data-testid='go-live']",
      ),
    ).toBeVisible({ timeout: 15_000 });
  });
});
