import { test, expect } from "@playwright/test";

// Public surfaces — no auth, no account created. Proves the deployed site
// renders its key pages and the public API returns the expected shapes.

const PAGES: { path: string; heading: RegExp }[] = [
  { path: "/", heading: /in motion/i },
  { path: "/grid", heading: /every race in america/i },
  { path: "/tracks", heading: /tracks worth fighting for/i },
  { path: "/racers", heading: /racers of inmotu/i },
  { path: "/standings", heading: /who'?s on top/i },
  { path: "/frontline", heading: /right to race/i },
  { path: "/rules", heading: /know the rules/i },
  { path: "/pricing", heading: /priced for the paddock/i },
  { path: "/start", heading: /already part of it/i },
  { path: "/map", heading: /every track in america/i },
];

test.describe("public smoke", () => {
  test("home loads with title and hero", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/inmotu/i);
    // Assert the app-rendered <h1>, which is identical across viewports.
    await expect(page.getByRole("heading", { level: 1, name: /in motion/i })).toBeVisible();
  });

  test("primary CTA routes to sign-up", async ({ page }) => {
    await page.goto("/");
    // In-content hero CTA — rendered in both desktop and mobile layouts
    // (unlike the header nav, which collapses on mobile).
    await page.getByRole("link", { name: /find your people/i }).first().click();
    await expect(page).toHaveURL(/\/register/);
    await expect(page.getByRole("button", { name: /create free account/i })).toBeVisible();
  });

  for (const { path, heading } of PAGES) {
    test(`page ${path} renders its heading`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    });
  }
});

test.describe("public API", () => {
  test("health returns ok + env", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(typeof body.env).toBe("string");
  });

  test("meta/config exposes app_url and mapbox token field", async ({ request }) => {
    const res = await request.get("/api/meta/config");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(typeof body.app_url).toBe("string");
    expect("mapbox_token" in body).toBeTruthy(); // string when configured, null otherwise
  });

  test("events list returns an array", async ({ request }) => {
    const res = await request.get("/api/events");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(Array.isArray(body.events)).toBeTruthy();
  });

  test("rules list returns an array", async ({ request }) => {
    const res = await request.get("/api/rules");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(Array.isArray(body.rules)).toBeTruthy();
  });

  test("legislation returns an array", async ({ request }) => {
    const res = await request.get("/api/advocacy/legislation");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(Array.isArray(body.legislation)).toBeTruthy();
  });

  test("endangered tracks returns an array", async ({ request }) => {
    const res = await request.get("/api/advocacy/endangered");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(Array.isArray(body.tracks)).toBeTruthy();
  });
});
