import { test, expect } from "@playwright/test";
import { loginAsStudent } from "./helpers";

test.describe("Profile screen", () => {
  test("three-tab segmented control switches", async ({ page }) => {
    await loginAsStudent(page);
    await page.goto("/profile");
    await expect(page.getByRole("heading", { name: /my profile|profile/i })).toBeVisible();

    // Default tab is Profile; click Mastery
    await page.getByRole("tab", { name: /^mastery$/i }).click();
    await expect(page.getByRole("tab", { name: /^mastery$/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    // Click Badges
    await page.getByRole("tab", { name: /^badges$/i }).click();
    await expect(page.getByRole("tab", { name: /^badges$/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    // Back to Profile
    await page.getByRole("tab", { name: /^profile$/i }).click();
    await expect(page.getByRole("tab", { name: /^profile$/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  test("identity is read-only (D-016) — change password is the only mutator", async ({
    page,
  }) => {
    await loginAsStudent(page);
    await page.goto("/profile");
    // No input[type=text] for name/email/phone/dob on the page — only labelled
    // read-only rows. The change-password button opens the dialog.
    await expect(
      page.locator('input[type="text"]').filter({ hasText: "" }),
    ).toHaveCount(0);
    await page.getByTestId("open-change-password").click();
    await expect(page.getByTestId("new-password-input")).toBeVisible();
    // Close the dialog.
    await page.keyboard.press("Escape");
  });
});
