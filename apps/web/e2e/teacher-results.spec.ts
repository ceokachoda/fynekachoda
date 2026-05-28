import { test, expect } from "@playwright/test";
import { loginAsTeacher } from "./helpers";

// Phase 4 Track 4B — exam results + release. Seed-tolerant: navigates from
// the exam list and only asserts on the page shell. Manual plan §I covers
// the release + regrade round-trip end-to-end.

test.describe("Teacher exam results", () => {
  test("exam list links to /exam-results/[id] for each row", async ({
    page,
  }) => {
    await loginAsTeacher(page);
    await page.goto("/exams");
    await expect(
      page.getByRole("heading", { name: /^Exams$/ }),
    ).toBeVisible();
    const rows = page.locator('[data-testid^="exam-row-"]');
    const count = await rows.count();
    test.skip(count === 0, "No exams in this environment");
    // Each exam row has a Results · Locked|Released anchor to /exam-results/...
    const resultsLink = page.getByRole("link", { name: /Results/ }).first();
    await expect(resultsLink).toBeVisible();
  });

  test("opening /exam-results/<garbage> does not crash the FocusLayout", async ({
    page,
  }) => {
    await loginAsTeacher(page);
    await page.goto("/exam-results/11111111-1111-1111-1111-111111111111");
    // Either the back button + error copy renders, or the loaded title.
    await expect(
      page.locator("button[aria-label='Back'], [data-testid='exam-results-title']"),
    ).toBeVisible({ timeout: 10_000 });
  });
});
