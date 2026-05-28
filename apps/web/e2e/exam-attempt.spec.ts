import { test, expect } from "@playwright/test";
import { loginAsStudent } from "./helpers";

// Exam discovery + locked-result test. Skips when the seed has no exam.

test.describe("Exam — discovery + pre-attempt", () => {
  test("classes shell exposes exam rows as clickable links", async ({ page }) => {
    await loginAsStudent(page);
    await page.goto("/classes");
    // The Phase 2 exam row was a static <li>; Phase 3 turns it into a Link
    // with data-testid="exam-link".
    const examLinks = page.getByTestId("exam-link");
    const count = await examLinks.count();
    test.skip(count === 0, "No exams visible to this student");
    const href = await examLinks.first().getAttribute("href");
    expect(href).toMatch(/^\/exam\//);
  });

  test("exam route gates non-student roles", async ({ page }) => {
    await page.goto("/login");
    await page
      .getByLabel(/email/i)
      .fill(process.env.E2E_TEACHER_EMAIL ?? "review.teacher@fynestudy.app");
    await page
      .getByLabel(/password/i)
      .fill(process.env.E2E_TEACHER_PASSWORD ?? "ReviewTeacher#2026");
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL("/");
    await page.goto("/exam/22222222-2222-2222-2222-222222222222");
    await page.waitForURL(/\/$/);
  });
});
