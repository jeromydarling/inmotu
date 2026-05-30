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

### Configure Stripe (optional — billing degrades gracefully without it)

```bash
npx wrangler secret put STRIPE_SECRET_KEY
npx wrangler secret put STRIPE_WEBHOOK_SECRET
npx wrangler secret put STRIPE_PRICE_FAMILY    # price_… for Family
npx wrangler secret put STRIPE_PRICE_PRO
npx wrangler secret put STRIPE_PRICE_TOWER
```

Point the Stripe webhook at `https://inmotu.pro/api/billing/webhook`.

## Scripts

| Script | Does |
|---|---|
| `npm run dev` | Vite dev server (SPA) with `/api` proxy |
| `npm run build` | Type-check + build SPA to `dist/client` |
| `npm run deploy` | Build + `wrangler deploy` |
| `npm run db:migrate:remote` | Apply D1 migrations to production |
| `npm run typecheck` | Type-check worker + app |

## Project status

MVP. The Grid, Pit Board, Tracks, Frontline, auth, and Stripe billing are
functional and tested end-to-end. The Tower and Garage modules extend the same
schema and are the next build.
