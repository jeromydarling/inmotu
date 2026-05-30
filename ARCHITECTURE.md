# inmotu — System Architecture

> The operating system for grassroots motorsports. A production-ready MVP
> built to scale to millions of users on Cloudflare's edge.

---

## 1. Design goals

| Goal | How it's met |
|---|---|
| **Scale to millions** | Stateless Worker on Cloudflare's global edge (300+ PoPs). D1 for relational data, KV for sessions — both horizontally managed by Cloudflare. No servers to run. |
| **Minimal but complete** | One repo, one deploy artifact (a Worker that serves both API and SPA). No separate frontend host, no container, no VPC. |
| **Fast everywhere** | Static assets served from edge cache; API co-located with data; SPA is 68 KB gzipped. |
| **Cheap to run at MVP** | D1 + KV + Workers free tiers cover early traffic; cost grows linearly, not in step-functions. |
| **Secure by default** | HttpOnly + SameSite session cookies, PBKDF2 password hashing in WebCrypto, parameterized SQL everywhere. |

## 2. High-level diagram

```
                         ┌──────────────────────────────┐
        inmotu.pro  ───▶ │   Cloudflare Worker (Hono)    │
   (custom domain on CF) │                                │
                         │  /api/*  ──▶ API router        │
                         │            ├─ auth (KV sessions)
                         │            ├─ events / tracks  │
                         │            ├─ riders / budget  │
                         │            ├─ advocacy         │
                         │            └─ billing (Stripe) │
                         │                                │
                         │  /*      ──▶ ASSETS (React SPA)│  ← static, SPA fallback
                         └───────┬───────────────┬────────┘
                                 │               │
                      ┌──────────▼───┐   ┌───────▼────────┐
                      │  D1 (SQLite) │   │ KV (sessions)  │
                      │  inmotu-prod │   │ inmotu-sessions│
                      └──────────────┘   └────────────────┘
                                 │
                      ┌──────────▼─────────────────────────┐
                      │ External: Stripe · MotorsportReg ·  │
                      │ MX Sports feed · SEMA/AMA bill data │
                      └─────────────────────────────────────┘
```

A single Worker is the entire backend. Cloudflare serves SPA assets directly
from edge cache; only `/api/*` paths invoke Worker code (`run_worker_first`),
so the marketing site and app shell cost zero compute to serve.

## 3. Stack

- **Runtime:** Cloudflare Workers (V8 isolates, `nodejs_compat`)
- **API framework:** [Hono](https://hono.dev) — tiny, edge-native router
- **Database:** Cloudflare **D1** (SQLite at the edge), accessed via prepared statements
- **Sessions / cache:** Cloudflare **KV**
- **Frontend:** React 18 + TypeScript + Vite + React Router
- **Styling:** Tailwind CSS (custom `inmotu` design system)
- **Payments:** Stripe Checkout + webhooks (subscription tiers)
- **Auth:** First-party email/password, PBKDF2-SHA256 (120k iterations) in WebCrypto, opaque session tokens in KV

## 4. Repository layout

```
inmotu/
├── wrangler.jsonc          # Worker config: bindings, assets, D1, KV
├── vite.config.ts          # SPA build → dist/client (+ /api dev proxy)
├── tailwind.config.ts      # inmotu design tokens
├── migrations/             # D1 schema + seed (versioned)
│   ├── 0001_init.sql
│   └── 0002_seed.sql
├── shared/types.ts         # API contract types (imported by both sides)
├── worker/                 # ─── Backend (Hono on Workers) ───
│   ├── index.ts            # app entry: mounts /api/*, falls back to ASSETS
│   ├── types.ts            # Env bindings
│   ├── db.ts               # D1 helpers, user mapping
│   ├── auth/               # password hashing, KV sessions, middleware
│   ├── lib/util.ts         # ids, hashing, validation
│   └── routes/             # auth, events, tracks, riders, advocacy, billing, meta
└── src/                    # ─── Frontend (React SPA) ───
    ├── api/client.ts       # typed fetch wrapper
    ├── state/auth.tsx      # auth context
    ├── components/         # Layout, EventCard, Logo, UI kit
    └── pages/              # Landing, Grid, Tracks, Frontline, Pricing, Dashboard, auth
```

## 5. Data model

Single user identity feeds all five product modules (see `migrations/0001_init.sql`):

- **Identity** — `users`, `subscriptions`
- **Module 1 · The Grid** — `events`, `saved_events`, `tracks`, `ladders`, `ladder_stages`
- **Module 2 · The Pit Board** — `riders`, `rider_ladder_progress`, `maintenance_logs`, `budget_entries`
- **Module 3 · The Tower** — `events.operator_id`, `registrations`
- **Module 4 · The Garage** — `vehicle_setups`, `stint_plans`
- **Module 5 · The Frontline** — `legislation`, `track_threats`, `advocacy_actions`
- Reference — `disciplines`, `sanctioning_bodies`

Covering indexes are defined for the hot read paths (event feed by
discipline + date, legislation by status, tracks by state/status,
registrations by event). All five modules share the one `users` identity.

## 6. API surface

All under `/api`. Auth via session cookie; mutating family/operator routes
require a session.

```
GET  /api/health
POST /api/auth/register · /login · /logout      GET /api/auth/me
GET  /api/events            (?discipline&region&level&q&from)
GET  /api/events/:slug
POST /api/events/:id/save   (auth, toggle)       GET /api/events/saved/mine (auth)
GET  /api/tracks (?discipline&state&status)      GET /api/tracks/:slug
GET  /api/riders (auth) · POST /api/riders (auth) · DELETE /api/riders/:id (auth)
GET  /api/riders/budget/summary (auth) · POST /api/riders/budget (auth)
POST /api/events/:id/register (auth)             GET /api/events/registrations/mine (auth)
GET  /api/advocacy/legislation (?status&state) · GET /api/advocacy/endangered
POST /api/advocacy/support (auth)
GET/POST /api/tower/events (auth, operator)      GET /api/tower/events/:id/registrations (auth)
GET/POST/DELETE /api/garage/setups (auth)        GET/POST/DELETE /api/garage/stints (auth)
GET  /api/meta/reference · /api/meta/stats
GET  /api/billing/plans · POST /api/billing/checkout (auth) · POST /api/billing/webhook
```

## 7. Scaling path

- **Reads:** enable D1 [read replication](https://developers.cloudflare.com/d1/best-practices/read-replication/) (flip `read_replication` on) when read volume grows; the Worker is already stateless.
- **Event ingestion:** add a scheduled Worker (Cron Trigger) to pull MotorsportReg / MX Sports feeds into `events`. The `source` column already namespaces origins.
- **Notifications:** deadline alerts → Cron Worker scanning `saved_events.reminder` + `events.reg_closes_at`, sending via push/email.
- **Media:** add an R2 bucket binding for the photo/video timeline and sponsor logos.
- **Hot media / heavy compute:** Durable Objects for the live pit board (Module 4) real-time gap display.

## 8. Security notes

- Passwords: PBKDF2-SHA256, 120k iterations, per-user random salt, constant-time compare.
- Sessions: opaque 30-day tokens in KV; cookie is `HttpOnly; SameSite=Lax; Secure` (prod).
- SQL: 100% parameterized via D1 prepared statements.
- Secrets (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, price IDs) are set with `wrangler secret put` — never committed. Billing degrades gracefully (HTTP 503 + UI hint) when unset, so the MVP runs without Stripe configured.
