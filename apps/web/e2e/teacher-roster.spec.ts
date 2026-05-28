import { test, expect } from "@playwright/test";
import { loginAsTeacher } from "./helpers";

// Phase 4 Track 4B — roster screen. Seed-tolerant; asserts the FocusLayout
// + access gating. The realtime roster sync is exercised by the manual
// plan §L.

test.describe("Teacher roster", () => {
  test("/roster/<id> requires teacher", async ({ page }) => {
    await page.goto("/roster/11111111-1111-1111-1111-111111111111");
    await expect(page).toHaveURL(/\/login/);
  });

  test("FocusLayout mounts + back button is reachable", async ({ page }) => {
    await loginAsTeacher(page);
    await page.goto("/roster/11111111-1111-1111-1111-111111111111");
    await expect(
      page.getByRole("button", { name: /back/i }),
    ).toBeVisible();
  });
});
