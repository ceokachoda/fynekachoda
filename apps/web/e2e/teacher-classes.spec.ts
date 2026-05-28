import { test, expect } from "@playwright/test";
import { loginAsTeacher } from "./helpers";

// Phase 4 Track 4B — teacher Classes screen. Lifts the seed-tolerant
// approach: confirms layout + that the Schedule-Live + Ad-hoc FABs render.

test.describe("Teacher Classes", () => {
  test("/classes renders the teacher-branch when active_role=teacher", async ({
    page,
  }) => {
    await loginAsTeacher(page);
    await page.goto("/classes");
    await expect(
      page.getByRole("heading", { name: /^Classes$/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /schedule live class/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /new ad-hoc class/i }),
    ).toBeVisible();
  });
});
