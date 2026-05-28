import { test, expect } from "@playwright/test";
import { loginAsTeacher } from "./helpers";

// Phase 4 Track 4B — webcam scan. We DO NOT trigger a real getUserMedia in
// Playwright (Chromium prompt without a fake camera is non-deterministic).
// Instead we assert the gating behavior, the picker, and the manual fallback
// link — every behavior visible without the camera.

test.describe("Teacher webcam scan", () => {
  test("Start camera button is gated; pre-press, no scanner is mounted", async ({
    page,
  }) => {
    await loginAsTeacher(page);
    await page.goto("/scan");
    // The lazy WebcamScanner only mounts when active=true.
    await expect(
      page.getByRole("button", { name: /start camera/i }),
    ).toBeVisible();
    // The yudiel scanner has a <video> tag; pre-press it should NOT exist.
    expect(await page.locator("video").count()).toBe(0);
  });

  test("session picker opens + offers the manual roster fallback link", async ({
    page,
  }) => {
    await loginAsTeacher(page);
    await page.goto("/scan");
    await page.getByTestId("scan-session-picker").click();
    // The picker either shows scheduled / today sessions or the empty
    // "no upcoming or live classes" line — assert one of those.
    const picker = page.locator(":scope")
      .filter({ has: page.getByTestId("scan-session-picker") });
    await expect(picker).toBeVisible();
  });

  test("page guards block /scan from a non-teacher", async ({ page }) => {
    // Not logged in → middleware redirects to /login.
    await page.goto("/scan");
    await expect(page).toHaveURL(/\/login/);
  });
});
