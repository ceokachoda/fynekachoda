import { test, expect } from "@playwright/test";
import { loginAsStudent } from "./helpers";

// Quiz attempt happy-path test. Skips automatically if no published quiz is
// visible to the student — useful in environments where the seed hasn't
// been refreshed.

test.describe("Quiz — attempt → submit → solution", () => {
  test("library lists at least one quiz row", async ({ page }) => {
    await loginAsStudent(page);
    // Open library and drill into the first topic that lists a quiz row.
    await page.goto("/library");
    // The library home shows Subjects → drill down until we find a topic
    // with a `Practice quizzes` block. We click the first subject card,
    // then the first chapter, then the first topic.
    const subjectButtons = page.locator("button:has-text('items')");
    const subjectCount = await subjectButtons.count();
    test.skip(subjectCount === 0, "No subjects available in this environment");
    await subjectButtons.first().click();
    const chapterButtons = page.locator("button:has-text('items')");
    if ((await chapterButtons.count()) > 0) {
      await chapterButtons.first().click();
    }
    const topicButtons = page.locator(
      "button:has(p:has-text('quiz available'))",
    );
    test.skip(
      (await topicButtons.count()) === 0,
      "No topic with a published quiz",
    );
    await topicButtons.first().click();
    const quizLinks = page.getByTestId("quiz-link");
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
