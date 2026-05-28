import { test, expect } from "@playwright/test";
import { loginAsTeacher } from "./helpers";

// Phase 4 Track 4B — quiz + exam builders. Seed-tolerant: just verify route +
// scaffolding render. Full save flow is covered by the manual plan because it
// touches RLS-protected real tables.

test.describe("Teacher builders", () => {
  test("/quiz-builder/new mounts the FocusLayout shell + title input", async ({
    page,
  }) => {
    await loginAsTeacher(page);
    await page.goto("/quiz-builder/new");
    await expect(page.getByTestId("quiz-builder-title")).toBeVisible();
    await expect(
      page.getByTestId("quiz-builder-publish"),
    ).toBeVisible();
  });

  test("/exam-builder/new mounts the FocusLayout shell + title input", async ({
    page,
  }) => {
    await loginAsTeacher(page);
    await page.goto("/exam-builder/new");
    await expect(page.getByTestId("exam-builder-title")).toBeVisible();
    await expect(
      page.getByTestId("exam-builder-publish"),
    ).toBeVisible();
  });

  test("publish without title shows the inline error (no server roundtrip)", async ({
    page,
  }) => {
    await loginAsTeacher(page);
    await page.goto("/exam-builder/new");
    await page.getByTestId("exam-builder-publish").click();
    await expect(page.getByTestId("builder-error")).toBeVisible();
  });
});
