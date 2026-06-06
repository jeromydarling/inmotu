<div align="center">

# inmotu

**Grassroots motorsports, in motion.**

The operating system for youth and amateur racing in America — one app for the
event calendar, your racing family, track operations, and the fight to keep
local tracks alive. Built on Cloudflare's edge to scale to millions.

</div>

---

## What it is

inmotu unifies five modules under one rider identity:

1. **The Grid** — the first unified calendar of every sanctioned amateur event (MX, autocross, road race, endurance, short track), with smart registration-deadline alerts.
2. **The Pit Board** — multi-rider family profiles, the Road-to-Loretta's qualifying-ladder tracker, maintenance logs, and a season budget tracker.
3. **The Tower** — affordable operations software for family-run tracks (registration, payments, series points, sponsor CRM).
4. **The Garage** — team ops: setup database, endurance stint planner, live cellular pit board.
5. **The Frontline** — a Right-to-Race advocacy network: bill tracker across 14 states, endangered-tracks map, one-tap legislator contact.

This repo ships a **production-ready MVP** of The Grid, The Pit Board, Tracks,
The Frontline, auth, and billing — with the full schema for all five modules.

See **[ARCHITECTURE.md](./ARCHITECTURE.md)** for the system design.

## Tech stack

React + Vite SPA · **Hono** API on **Cloudflare Workers** · **D1** (SQLite) ·
**KV** sessions · **Stripe** subscriptions · Tailwind CSS.

## Quick start (local)

```bash
npm install
npm run build                       # build the SPA into dist/client
npm run db:migrate:local            # apply schema + seed to local D1

# Terminal A — run the Worker (API + assets) on :8787
npx wrangler dev --port 8787 --local

# Terminal B — run the Vite dev server on :5173 (proxies /api → :8787)
npm run dev
```

Open http://localhost:5173. Create an account, browse The Grid, save events,
add a rider, and pledge support on The Frontline.

## Deploy to Cloudflare (inmotu.pro)

Bindings are already provisioned and wired in `wrangler.jsonc`:

- D1 `inmotu-prod` (`d9c95da3-…`) — schema + seed already applied to production
- KV `inmotu-sessions`
- Worker `inmotu`

**Option A — Git integration (recommended).** In the Cloudflare dashboard,
connect this repo to the `inmotu` Worker (Workers Builds). Set the build
command to `npm run build` and it deploys on every push to the main branch.

**Option B — CLI.**

```bash
npx wrangler login
npm run deploy            # = npm run build && wrangler deploy
```

Then bind the custom domain `inmotu.pro` to the Worker (Workers & Pages →
inmotu → Settings → Domains & Routes → Add custom domain).

### Configure Stripe

The three subscription products + live monthly prices already exist in Stripe,
and their **Price IDs are wired into `wrangler.jsonc`** (Family $9.99, Pro
$19.99, Tower $49). Only the **secret key** and **webhook secret** remain — set
them once and live billing is on:

```bash
npx wrangler secret put STRIPE_SECRET_KEY      # sk_live_…
npx wrangler secret put STRIPE_WEBHOOK_SECRET  # whsec_… (REQUIRED for the webhook)
```

Then add a webhook endpoint in the Stripe dashboard pointing at
`https://inmotu.pro/api/billing/webhook` (events: `checkout.session.completed`,
`customer.subscription.*`). The webhook **verifies the `Stripe-Signature`
HMAC** and fails closed: without `STRIPE_WEBHOOK_SECRET` set, all webhook
calls are rejected (so a forged POST can't grant entitlements). Until the
secret key is set, checkout returns a clean "not configured" message instead
of erroring.

### Maps (Mapbox)

The endangered-tracks defense map and the track-directory map use Mapbox GL.
Add a **publishable** token (`pk.…`) as `MAPBOX_TOKEN` in `wrangler.jsonc` vars
(or a secret). Until set, maps render an on-brand list fallback. Mapbox JS is
code-split and only loads when a map is shown.

### Season Yearbook (Lulu Print)

Parents order a printed photo book of their racer's season ($59 one-time). The
Stripe product/price already exist (`STRIPE_PRICE_YEARBOOK`). To enable print
fulfillment, set Lulu credentials (`LULU_ENV` var = `sandbox`|`production`):

```bash
npx wrangler secret put LULU_CLIENT_KEY
npx wrangler secret put LULU_CLIENT_SECRET
```

On payment the webhook calls `fulfillYearbook()`, which authenticates with Lulu
and — once the book-PDF pipeline lands — creates the print job. Without keys,
paid orders are held at status `paid`; the purchase still succeeds.

## Scripts

| Script | Does |
|---|---|
| `npm run dev` | Vite dev server (SPA) with `/api` proxy |
| `npm run build` | Type-check + build SPA to `dist/client` |
| `npm run deploy` | Build + `wrangler deploy` |
| `npm run db:migrate:remote` | Apply D1 migrations to production |
| `npm run typecheck` | Type-check worker + app |

## Project status

Built and tested end-to-end:

- **The Grid** — event aggregator, filters, save-to-calendar, .ics export, registration
- **The Pit Board** — multi-rider family hub, budget tracker, **photo timeline**
- **Road to the Ranch** — live qualifying-ladder tracker (Area → Regional → National)
- **The Tower** — operator event publishing, registrations, economic-impact reports
- **The Garage** — setup database + endurance stint planner
- **The Frontline** — Right to Race bill tracker, one-tap legislator contact, **endangered-tracks map**
- **Tracks** — directory + **Mapbox map view**
- **Season Yearbook** — printed photo book via Stripe + Lulu (fulfillment behind keys)

Plus first-party auth (PBKDF2 + KV sessions) and Stripe billing (live
subscription + yearbook products; set the secret key to switch on checkout).

<!-- deploy-trigger: 2026-06-06T01:46:15Z (Sentry DSN bake-in) -->