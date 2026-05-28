import { test, expect } from "@playwright/test";
import { loginAsStudent } from "./helpers";

test.describe("Attendance screen", () => {
  test("renders heading + today's classes + history sections", async ({ page }) => {
    await loginAsStudent(page);
    await page.goto("/attendance");
    await expect(page.getByRole("heading", { name: /attendance/i })).toBeVisible();
    await expect(page.getByText(/Today's classes/i)).toBeVisible();
    await expect(page.getByText(/My history/i)).toBeVisible();
  });
});
