import { test, expect } from "@playwright/test";

// Credentials documented in CREDENTIALS.local.md. The first two accounts exist
// in production; multi-role + suspended are created by the user during the
// manual QA pass (see Phases/phase-1-manual-tests.md §0). Skipped cases will
// un-skip themselves the moment the env vars are populated.

const STUDENT_EMAIL = process.env.E2E_STUDENT_EMAIL ?? "review.student@fynestudy.app";
const STUDENT_PASSWORD = process.env.E2E_STUDENT_PASSWORD ?? "ReviewStudent#2026";
const TEACHER_EMAIL = process.env.E2E_TEACHER_EMAIL ?? "review.teacher@fynestudy.app";
const TEACHER_PASSWORD = process.env.E2E_TEACHER_PASSWORD ?? "ReviewTeacher#2026";

const MULTIROLE_EMAIL = process.env.E2E_MULTIROLE_EMAIL;
const MULTIROLE_PASSWORD = process.env.E2E_MULTIROLE_PASSWORD;
const SUSPENDED_EMAIL = process.env.E2E_SUSPENDED_EMAIL;
const SUSPENDED_PASSWORD = process.env.E2E_SUSPENDED_PASSWORD;

test.describe("Public + unauth", () => {
  test("redirects to /login when unauthenticated and visits root", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login(\?next=.*)?$/);
    await expect(page.getByRole("heading", { name: /welcome to fynestudy/i })).toBeVisible();
  });

  test("/privacy is reachable without auth", async ({ page }) => {
    await page.goto("/privacy", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/Privacy/i);
  });

  test("/terms is reachable without auth", async ({ page }) => {
    await page.goto("/terms", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/Terms/i);
  });

  test("login form shows inline error on wrong password", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(STUDENT_EMAIL);
    await page.getByLabel(/password/i).fill("definitely-wrong-password-xx");
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page.getByText(/invalid email or password/i)).toBeVisible({
      timeout: 10_000,
    });
  });
});

test.describe("Student flow", () => {
  test("logs in as a student and lands on the student dashboard", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(STUDENT_EMAIL);
    await page.getByLabel(/password/i).fill(STUDENT_PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL("/");
    // The Phase 2 student dashboard is gated by appUser hydration; it renders
    // inside the protected layout. Either the dashboard container is visible,
    // or — for a brand-new account with no data — at least the heading.
    await expect(page.getByTestId("student-dashboard")).toBeVisible();
  });

  test("sign-out routes back to /login (and the back button can't re-enter)", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(STUDENT_EMAIL);
    await page.getByLabel(/password/i).fill(STUDENT_PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL("/");
    // Open profile menu (compact on mobile / full on desktop both reachable).
    const profileTrigger = page
      .getByRole("button", { name: /open profile menu/i })
      .first();
    await profileTrigger.click();
    await page.getByRole("menuitem", { name: /sign out/i }).click();
    await page.waitForURL(/\/login/);
    await page.goBack();
    await expect(page).toHaveURL(/\/login(\?next=.*)?$/);
  });
});

test.describe("Teacher flow", () => {
  test("logs in as a teacher and lands on the teacher home", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(TEACHER_EMAIL);
    await page.getByLabel(/password/i).fill(TEACHER_PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL("/");
    await expect(page.getByTestId("teacher-home")).toBeVisible();
  });
});

test.describe("Multi-role flow", () => {
  test.skip(
    !MULTIROLE_EMAIL || !MULTIROLE_PASSWORD,
    "Skipped until E2E_MULTIROLE_EMAIL / E2E_MULTIROLE_PASSWORD are set. See Phases/phase-1-manual-tests.md §0.",
  );

  test("multi-role user is forced through /role-chooser", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(MULTIROLE_EMAIL!);
    await page.getByLabel(/password/i).fill(MULTIROLE_PASSWORD!);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL("/role-chooser");
    await page.getByRole("button", { name: /continue as teacher/i }).click();
    await page.waitForURL("/");
    await expect(page.getByTestId("teacher-home")).toBeVisible();
  });
});

test.describe("Suspended flow", () => {
  test.skip(
    !SUSPENDED_EMAIL || !SUSPENDED_PASSWORD,
    "Skipped until E2E_SUSPENDED_EMAIL / E2E_SUSPENDED_PASSWORD are set. See Phases/phase-1-manual-tests.md §0.",
  );

  test("suspended user lands on /suspended and cannot reach a tab", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(SUSPENDED_EMAIL!);
    await page.getByLabel(/password/i).fill(SUSPENDED_PASSWORD!);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL("/suspended");
    await expect(page.getByRole("heading", { name: /account suspended/i })).toBeVisible();
    await page.goto("/classes");
    await expect(page).toHaveURL(/\/suspended/);
  });
});
