import { defineConfig, devices } from "@playwright/test";

// E2E runs against the DEPLOYED site (production by default). Override with
// BASE_URL to point at a preview/staging deployment. There is no local web
// server here — these specs exercise the real Cloudflare Worker + D1.
const BASE_URL = process.env.BASE_URL || "https://inmotu.pro";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false, // the journey is a serial, stateful sign-up flow
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: BASE_URL,
    // Collapse animations to instant — keeps framer/CSS tweens from leaving
    // elements "unstable" and timing out .click(). The app's CSS honors
    // @media (prefers-reduced-motion: reduce).
    reducedMotion: "reduce",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    trace: "on-first-retry",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
});
