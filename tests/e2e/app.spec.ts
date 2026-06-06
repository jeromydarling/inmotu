import { test, expect } from "@playwright/test";

// Negative / edge paths. These create NO accounts and use a fresh context per
// test (the default `page` fixture), so they're safe to run in parallel with
// nothing to clean up.

test("bad login shows an error and does not sign in", async ({ page }) => {
  await page.goto("/login");
  await page.locator('input[name="email"]').fill("e2e+nope-" + Date.now() + "@example.com");
  await page.locator('input[name="password"]').fill("definitely-wrong-pw");
  await page.getByRole("button", { name: /^sign in$/i }).click();
  // Server replies 401 → the form surfaces the message; we stay on /login.
  await expect(page.getByText(/invalid email or password/i)).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

test("unknown route renders the 404 page", async ({ page }) => {
  await page.goto("/this-route-does-not-exist-" + Date.now());
  await expect(page.getByText("404")).toBeVisible();
  await expect(page.getByText(/doesn'?t exist/i)).toBeVisible();
});

test("protected app route redirects anonymous users to login", async ({ page }) => {
  await page.goto("/app");
  await expect(page).toHaveURL(/\/login/);
});
