import { test, expect, request as pwRequest, type Page } from "@playwright/test";

// ─────────────────────────────────────────────────────────────────────────────
// THE JOURNEY: one brand-new user signs up on the DEPLOYED app and does
// everything a free user can — creating records, toggling state, pledging,
// changing settings — proving each survives a reload (i.e. hit the database,
// not just React state). Runs serially on a single shared account, which is
// purged in afterAll so CI never accumulates junk users.
//
// Email verification is OFF on the server (EMAIL_VERIFICATION unset), so signup
// yields a fully-usable account with no email-link step. Re-enable by setting
// the EMAIL_VERIFICATION="on" env var on the Worker — that one var is the only
// change required.
// ─────────────────────────────────────────────────────────────────────────────

test.describe.configure({ mode: "serial" });

const BASE_URL = process.env.BASE_URL || "https://inmotu.pro";
const PURGE_TOKEN = process.env.E2E_PURGE_TOKEN || "e2e-purge-inmotu-2026-7Kq2mZ";

// Unique disposable account per run. The local-part MUST start with "e2e+" —
// that's the only thing the server's purge endpoint will ever delete.
const EMAIL = `e2e+journey-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
const PASSWORD = "Journey-Test-9281";
const NAME = "Journey Tester";

let page: Page;

test.beforeAll(async ({ browser }, testInfo) => {
  // Build the context from the project's device profile so the shared page
  // keeps the desktop/mobile emulation, plus our baseURL + reduced motion.
  const context = await browser.newContext({
    ...testInfo.project.use,
    baseURL: BASE_URL,
    reducedMotion: "reduce",
  });
  page = await context.newPage();
});

test.afterAll(async () => {
  // Clean up the test account + ALL its rows, regardless of pass/fail.
  try {
    const ctx = await pwRequest.newContext({ baseURL: BASE_URL });
    const res = await ctx.post(
      `/api/admin/purge-user?token=${encodeURIComponent(PURGE_TOKEN)}&email=${encodeURIComponent(EMAIL)}`,
    );
    // Best-effort: log the outcome but never fail the run on cleanup.
    console.log("purge:", res.status(), await res.text());
    await ctx.dispose();
  } catch (e) {
    console.warn("purge failed (non-fatal):", e);
  }
  await page.close();
});

// Helper: open the dashboard and switch to a tab by its visible label.
async function openTab(name: RegExp) {
  await page.getByRole("button", { name }).first().click();
}

test("1 · marketing landing → sign-up", async () => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: /in motion/i })).toBeVisible();
  await page.getByRole("link", { name: /find your people/i }).first().click();
  await expect(page).toHaveURL(/\/register/);
});

test("2 · sign up a brand-new user → lands signed-in in the app", async () => {
  await page.locator('input[name="full_name"]').fill(NAME);
  await page.locator('input[name="email"]').fill(EMAIL);
  await page.locator('input[name="password"]').fill(PASSWORD);
  await page.locator('input[name="zip"]').fill("55044");
  await page.getByRole("button", { name: /create free account/i }).click();

  // Signed-in proof that holds on BOTH desktop and mobile: we reach the
  // protected dashboard, whose "Welcome back, <name>." <h1> only renders for an
  // authenticated user and is identical across layouts. (We deliberately don't
  // assert "Sign in" is absent — the footer always links to it regardless of
  // auth state.)
  await expect(page).toHaveURL(/\/app/);
  await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
});

test("3 · create a rider → persists across reload", async () => {
  await openTab(/^riders/i);
  await page.getByRole("button", { name: /\+ add rider/i }).click();
  await page.getByPlaceholder("Rider name").fill("Cole Journey");
  await page.getByPlaceholder("Number").fill("42");
  await page.getByRole("button", { name: /^save rider$/i }).click();

  await expect(page.getByText("Cole Journey")).toBeVisible();

  // Reload → re-open Riders → still there (proves it hit the DB).
  await page.reload();
  await openTab(/^riders/i);
  await expect(page.getByText("Cole Journey")).toBeVisible();
});

test("4 · publish the rider to the public directory → persists", async () => {
  await openTab(/^riders/i);
  const toggle = page.getByRole("button", { name: /toggle public profile/i }).first();
  await expect(toggle).toBeVisible();
  await toggle.click();
  // A public /racers/<slug> link appears once published.
  await expect(page.getByRole("link", { name: /\/racers\// }).first()).toBeVisible();

  await page.reload();
  await openTab(/^riders/i);
  await expect(page.getByRole("link", { name: /\/racers\// }).first()).toBeVisible();
});

test("5 · a plan-gated tab shows the upgrade prompt (free account)", async () => {
  await openTab(/^budget/i); // family feature
  await expect(page.getByRole("link", { name: /upgrade to/i })).toBeVisible();
});

test("6 · save an event to the calendar → persists + shows on dashboard", async () => {
  // The public Grid intentionally hides fabricated seed events, and this
  // environment currently has only seed/demo events — so the Grid is honestly
  // empty. Fetch a slug directly (including demo) to exercise the save flow on
  // a real event-detail page; this works identically once real events exist.
  await page.goto("/grid");
  await expect(page.getByRole("heading", { level: 1, name: /every race in america/i })).toBeVisible();

  const res = await page.request.get("/api/events?include_demo=1&include_unverified=1");
  const { events } = await res.json();
  expect(Array.isArray(events) && events.length > 0).toBeTruthy();
  const slug = events[0].slug;

  await page.goto(`/events/${slug}`);
  await expect(page).toHaveURL(/\/events\//);
  const title = (await page.getByRole("heading", { level: 1 }).textContent())?.trim() || "";
  expect(title.length).toBeGreaterThan(0);

  const saveBtn = page.getByRole("button", { name: /save to my calendar/i });
  await expect(saveBtn).toBeVisible();
  await saveBtn.click();
  await expect(page.getByRole("button", { name: /saved to calendar/i })).toBeVisible();

  // Reload the event → still saved (DB-backed).
  await page.reload();
  await expect(page.getByRole("button", { name: /saved to calendar/i })).toBeVisible();

  // Cross-surface proof: the saved event appears on the dashboard calendar.
  await page.goto("/app");
  await expect(page.getByText(title).first()).toBeVisible();
});

test("7 · pledge support on the Frontline → persists across reload", async () => {
  await page.goto("/frontline");
  const pledge = page.getByRole("button", { name: /^pledge support$/i }).first();
  await expect(pledge).toBeVisible();
  await pledge.click();
  await expect(page.getByRole("button", { name: /pledged/i }).first()).toBeVisible();

  await page.reload();
  await expect(page.getByRole("button", { name: /pledged/i }).first()).toBeVisible();
});

test("8 · change a notification setting → persists across reload", async () => {
  await page.goto("/app/settings");
  await expect(page.getByRole("heading", { name: /your account/i })).toBeVisible();

  const emailToggle = page
    .locator("label")
    .filter({ hasText: "Email notifications" })
    .getByRole("button");
  await expect(emailToggle).toBeVisible();
  // Default is ON → turn it OFF.
  await expect(emailToggle).toHaveAttribute("aria-pressed", "true");
  await emailToggle.click();
  await expect(emailToggle).toHaveAttribute("aria-pressed", "false");

  await page.reload();
  const emailToggle2 = page
    .locator("label")
    .filter({ hasText: "Email notifications" })
    .getByRole("button");
  await expect(emailToggle2).toHaveAttribute("aria-pressed", "false");
});

test("9 · AI translation (Llama) returns Spanish for dynamic content", async () => {
  test.setTimeout(35_000); // model call — allow generous headroom
  const input = "Know the rules. Race with confidence.";
  const res = await page.request.post("/api/translate", {
    data: { texts: [input], target: "es" },
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(Array.isArray(body.translations)).toBeTruthy();
  expect(typeof body.translations[0]).toBe("string");
  expect(body.translations[0].length).toBeGreaterThan(0);
  // A real translation differs from the English source.
  expect(body.translations[0]).not.toBe(input);
});

test("10 · session survives a cold reload, then sign out", async () => {
  // Navigate away and back; the session cookie keeps us in the protected app.
  await page.goto("/");
  await page.goto("/app");
  await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();

  // Sign out — viewport-safe: open the mobile menu first if it's present.
  const menu = page.getByRole("button", { name: "Menu" });
  if (await menu.isVisible().catch(() => false)) await menu.click();
  await page.getByRole("button", { name: /sign out/i }).click();

  // Sign-out is async (clear session, then navigate home). Wait for that
  // navigation to land before probing — otherwise the cookie may not be
  // cleared yet. Leaving /app confirms logout completed.
  await expect(page).not.toHaveURL(/\/app/);

  // Logged-out proof that holds on both layouts: the protected app now
  // redirects to the login page.
  await page.goto("/app");
  await expect(page).toHaveURL(/\/login/);
});
