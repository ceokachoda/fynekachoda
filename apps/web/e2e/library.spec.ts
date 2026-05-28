import { test, expect } from "@playwright/test";
import { loginAsStudent } from "./helpers";

test.describe("Library screen", () => {
  test("renders subjects view with a search box", async ({ page }) => {
    await loginAsStudent(page);
    await page.goto("/library");
    await expect(page.getByRole("heading", { name: /library|content/i })).toBeVisible();
    await expect(page.getByTestId("library-search")).toBeVisible();
  });

  test("search box updates the URL ?q= param after debounce", async ({ page }) => {
    await loginAsStudent(page);
    await page.goto("/library");
    const search = page.getByTestId("library-search");
    await search.fill("kinematics");
    await page.waitForTimeout(400);
    await expect(page).toHaveURL(/q=kinematics/);
  });
});
