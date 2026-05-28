import type { Page } from "@playwright/test";

export const STUDENT_EMAIL =
  process.env.E2E_STUDENT_EMAIL ?? "review.student@fynestudy.app";
export const STUDENT_PASSWORD =
  process.env.E2E_STUDENT_PASSWORD ?? "ReviewStudent#2026";

export async function loginAsStudent(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(STUDENT_EMAIL);
  await page.getByLabel(/password/i).fill(STUDENT_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL("/");
}
