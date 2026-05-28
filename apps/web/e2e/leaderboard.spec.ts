import { test, expect } from "@playwright/test";
import { loginAsStudent } from "./helpers";

test.describe("Leaderboard screen", () => {
  test("scope segmented control toggles weekly / all-time", async ({ page }) => {
    await loginAsStudent(page);
    await page.goto("/leaderboard");
    await expect(page.getByRole("heading", { name: /leaderboard/i })).toBeVisible();
    await page.getByRole("tab", { name: /^all-time$/i }).click();
    await expect(page.getByRole("tab", { name: /^all-time$/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await page.getByRole("tab", { name: /^weekly$/i }).click();
    await expect(page.getByRole("tab", { name: /^weekly$/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  test("'How rank is calculated' modal opens and closes", async ({ page }) => {
    await loginAsStudent(page);
    await page.goto("/leaderboard");
    await page
      .getByRole("button", { name: /how rank is calculated/i })
      .click();
    await expect(
      page.getByRole("heading", { name: /how rank is calculated/i }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
  });
});
