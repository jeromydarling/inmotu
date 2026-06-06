# End-to-end tests

Playwright specs that exercise the **deployed** inmotu app — a real browser
signing up a real (disposable) user and clicking through everything a free user
can do, with persistence verified by reloads.

## Layout

| File | What it covers |
| --- | --- |
| `e2e/smoke.spec.ts` | Public pages render (hero `<h1>` per page) + public API shapes. No auth, no account. |
| `e2e/journey.spec.ts` | **The journey.** Serial, one shared account: marketing → sign-up → riders → publish → upgrade-prompt → save event → pledge → settings → AI translation → cold-reload session → sign-out. Account purged in `afterAll`. |
| `e2e/app.spec.ts` | Negative paths (bad login, 404, protected-route redirect). Creates no accounts. |

## Running

These tests run against a **deployed** site — there is no local web server.

```bash
npm ci
npx playwright install --with-deps chromium   # first time only
npm run test:e2e                # both projects (desktop + mobile)
npm run test:e2e:ui             # interactive UI mode
npx playwright test --list      # parse/enumerate specs without a browser
```

> This dev sandbox can't launch a browser (no Chromium / blocked egress). Only
> `--list` works here; the full run happens in GitHub Actions (`.github/workflows/e2e.yml`),
> where Chromium and outbound network are available.

## Environment knobs

| Var | Default | Purpose |
| --- | --- | --- |
| `BASE_URL` | `https://inmotu.pro` | Target deployment. Override to test a preview. |
| `E2E_PURGE_TOKEN` | committed fallback in `wrangler.jsonc` | Auth for the cleanup endpoint. Override with a repo secret/var if desired. |
| `CI` | unset locally | When set: 2 retries, 1 worker, GitHub + HTML reporters. |

## How the moving parts fit

- **Email verification is OFF.** The server creates new users already-verified
  (no email-link step) unless `EMAIL_VERIFICATION="on"` is set on the Worker.
  That single env var is the only change needed to re-enable verification.
- **Cleanup.** `afterAll` calls `POST /api/admin/purge-user?token=…&email=…`,
  which deletes the user and every child row. It is token-guarded **and**
  hard-restricted to `e2e+…` emails, so it can never touch a real account.
- **Reduced motion.** `playwright.config.ts` sets `reducedMotion: "reduce"`,
  and the app's CSS honors `@media (prefers-reduced-motion: reduce)` — animations
  collapse to instant so elements are never "unstable" mid-tween.
- **Deploy gate.** A push to `main` triggers both the Cloudflare deploy and this
  workflow; the workflow waits until the new build is live (the purge route only
  exists in the new build) before running, so tests never race the deploy.

## Porting this rig to another Claude Code + Cloudflare app

1. Copy `playwright.config.ts`, `tests/`, and `.github/workflows/e2e.yml`.
2. Add a server flag so signup skips email verification by default
   (`EMAIL_VERIFICATION` here) and a token-guarded, test-email-restricted
   purge endpoint (`POST /api/admin/purge-user`).
3. Set `BASE_URL` to the app's production URL.
4. Rewrite the selectors in `journey.spec.ts` to the app's own nav/features —
   assert on the page `<h1>` (layout-independent), use `{ exact: true }` for
   short labels, append `.first()` to OR-regex locators, and after every
   create/toggle: **reload and re-assert** to prove it persisted.
