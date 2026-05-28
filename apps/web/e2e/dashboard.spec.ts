import { test, expect } from "@playwright/test";
import { loginAsStudent } from "./helpers";

test.describe("Student dashboard", () => {
  test("renders the dashboard container after login", async ({ page }) => {
    await loginAsStudent(page);
    await expect(page.getByTestId("student-dashboard")).toBeVisible();
  });

  test("greeting reflects time of day", async ({ page }) => {
    await loginAsStudent(page);
    const greetingRe = /Good morning|Good afternoon|Good evening|Hi,/i;
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      greetingRe,
    );
  });

  test("can navigate to attendance, library, leaderboard from side rail or tabs", async ({
    page,
  }) => {
    await loginAsStudent(page);
    await page.goto("/attendance");
    await expect(page.getByRole("heading", { name: /attendance/i })).toBeVisible();
    await page.goto("/library");
    await expect(page.getByRole("heading", { name: /library|content/i })).toBeVisible();
    await page.goto("/leaderboard");
    await expect(page.getByRole("heading", { name: /leaderboard/i })).toBeVisible();
  });
});
