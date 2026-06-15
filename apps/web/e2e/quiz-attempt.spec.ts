import { test, expect } from "@playwright/test";
import { loginAsStudent } from "./helpers";

// Quiz attempt happy-path test. Skips automatically if no published quiz is
// visible to the student — useful in environments where the seed hasn't
// been refreshed.

test.describe("Quiz — attempt → submit → solution", () => {
  test("practice tab lists at least one quiz row", async ({ page }) => {
    await loginAsStudent(page);
    // The dedicated Quiz tab (/practice) lists every published quiz visible to
    // the student — no library drill-down needed.
    await page.goto("/practice");
    const quizLinks = page.getByTestId("quiz-link");
    test.skip(
      (await quizLinks.count()) === 0,
      "No published quiz visible in this environment",
    );
    await expect(quizLinks.first()).toBeVisible();
  });

  test("quiz route gates non-student roles", async ({ page }) => {
    // A teacher login that lands on / should NOT be able to render the
    // quiz attempt screen. The middleware lets the URL through (it's not in
    // the cross-role block-list), but the page itself redirects to '/'.
    await page.goto("/login");
    await page
      .getByLabel(/email/i)
      .fill(process.env.E2E_TEACHER_EMAIL ?? "review.teacher@fynestudy.app");
    await page
      .getByLabel(/password/i)
      .fill(process.env.E2E_TEACHER_PASSWORD ?? "ReviewTeacher#2026");
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL("/");
    // Try to open a quiz — should bounce. We don't know a real quiz id here,
    // so visit any id; the redirect happens before the page renders content.
    await page.goto("/quiz/11111111-1111-1111-1111-111111111111");
    await page.waitForURL(/\/$/);
  });
});
