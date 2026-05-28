import { test, expect } from "@playwright/test";
import { loginAsTeacher } from "./helpers";

// Phase 4 Track 4B — teacher content upload form. Asserts kind toggle +
// scope picker render. The full presign+PUT+finalize flow is covered by the
// manual plan §F because PUT-with-progress is hard to mock without going to
// the real Supabase signed URL.

test.describe("Teacher content upload", () => {
  test("/content renders kind toggle + scope picker", async ({ page }) => {
    await loginAsTeacher(page);
    await page.goto("/content");
    await expect(
      page.getByRole("button", { name: /^video$/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /^pdf$/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /my batch/i }),
    ).toBeVisible();
  });
});
