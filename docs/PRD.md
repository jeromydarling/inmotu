# inmotu — Product Requirements Document

_Living document. Last updated alongside the local-discovery engine._

## 1. Vision

**inmotu is the operating system for grassroots motorsports — and the platform
that turns a curious family into a racing family.**

Two things no one else does well:

1. **The on-ramp.** Every sanctioning body (USA BMX, NHRA, MX Sports, SCCA)
   assumes you already race. Nobody owns the first step. inmotu is where a
   curious family finds a home _immediately_ — the easy first event, a welcoming
   track nearby, a local crew to call.
2. **The data nobody's captured.** The grassroots world is radically
   decentralized — clubs on Facebook, schedules in PDFs, points on flyers. The
   org that maps **every local crew, event, track, and racer** owns data no one
   has consolidated. **Data is king** — that dataset is the moat.

Guiding principle: **reach out into the world and pull in as much as we can —
tight and protected.** Aggregate aggressively; never present unverified data as
fact.

## 2. Who it's for

- **Curious / first-time families** — highest priority, least served.
- **Active racing families** — riders, results, the ladder, budget.
- **Track operators** — registration, series points, comms, impact (The Tower).

## 3. Sectors (the core abstraction)

A user picks one or more **sectors** at onboarding; the product adapts its
vocabulary, progression model, and which venue categories/disciplines surface.
Canonical definitions live in `shared/types.ts → SECTORS` (single source of
truth for Worker + SPA, so copy never drifts).

| Sector | Progression | Ladder name | Notes |
|---|---|---|---|
| Motocross | ladder | Road to the Ranch | |
| BMX Racing | ladder | Road to the #1 Plate | NAG best-8 + wins-to-class |
| Drag Racing | track_points | Track Points to Vegas | cumulative points projection |
| Sprint Karting | open | — | lead with LO206 |
| Dirt-Oval Karting | track_points | — | feature/heat vocab, not sprint |
| Road Racing | track_points | — | |
| Autocross | track_points | — | |

Each sector carries `label`, `tagline`, `venueCategories`, `disciplines`,
`vocab`, and `voice` (the community's real phrases, used in marketing). Research
briefs: `docs/communities/{bmx,drag,karting}.md`.

## 4. Modules

**Public / discovery**
- **The Grid** (`/grid`) — event calendar; `★ My sectors` scoping.
- **The National Canvas** (`/map`) — every US venue on a Mapbox GL globe;
  clustering, category layers, live-event glow. Seed + OSM/Overpass import;
  Perplexity enrichment; linked to tracks for "racing here next."
- **Start Here** (`/start`) — the newcomer on-ramp: per-sector how-to-start
  guides, beginner tracks, beginner events, **local crews**, commitment-free
  profile. State picker triggers live local discovery.
- **The Frontline** (`/frontline`) — Right-to-Race tracker (Perplexity, cited),
  battle map, ZIP→legislator (Google Civic).
- Standings, Tracks, Rules.

**Family tools (The Pit Board, `/app`)** — Riders, Calendar, **Ladder**
(sector-specific: BMX NAG best-8 + wins-to-class; drag track-points-to-Vegas),
Photos/Yearbook, Budget, Maintenance. Plan-gated: Garage, Sponsors, AI Studio,
Microsite.

**Operator tools (The Tower)** — registration, series points, comms, impact.

**Live + intelligence** — Speedhive live results; discovery engine; CF-native
crawler (Firecrawl-pluggable); Perplexity/Civic.

## 5. Architecture

- Cloudflare Workers + Hono API under `/api/*`; React SPA (Vite) as static
  assets. Single Worker (`worker/index.ts`).
- D1 (SQLite, 25 migrations) · KV sessions · R2 media · Workers AI (Llama) ·
  Mapbox (token in).
- Cron (daily): feeds, deadline sweep, legislation, live results, crawl, venue
  OSM import (weekly) + enrich; demo reaping.
- **Build discipline:** every commit must pass `npm run build` + worker `tsc`
  **and boot the dev server** — esbuild catches bundling issues tsc misses
  (e.g. `@shared` _value_ imports must use a relative path in Worker code).

## 6. Discovery & trust model (critical)

- **On-demand + cached.** Discovery for a `(sector, state)` runs only when a
  family looks; cached 21 days in `ai_cache`. Spend scales with interest.
- **Orgs only.** Crews = clubs/teams/series/track-programs/groups. Never private
  individuals. Public org contacts only; prompt forbids guessing emails/phones.
- **Verify-gated.** Every AI-found crew is `needs_review = 1`, shown
  **"unverified — tap the source to confirm,"** cited. Human approve → verified.
- **Model depth.** `sonar` for events; `sonar-pro` for crews.
- **Graceful.** No `PERPLEXITY_API_KEY` → no-op, `configured:false`, seed serves.
- Follow-up: rate-limit the public discovery trigger (currently bounded by cache
  + no-key default).

## 7. Data model highlights

`users.sectors` · `riders` (+wins, points_target, transponder) · `venues`
(category, beginner_friendly, starter_note, osm provenance, track link) ·
`tracks` · `events` (+needs_review, speedhive link) · `ladders`/`ladder_stages`
(progression, advance_note, pos_advances) · `rider_ladder_progress` ·
`bmx_scores` (NAG/points log) · `race_sessions`/`live_results` ·
`series`/`results` · `crews` (discovered orgs; contacts, citations,
needs_review, verified) · `legislation` · `track_threats` · `ai_cache` ·
`legislator_cache`.

## 8. Plans

Free (calendar + cause + 1 rider) · Family $9.99 (riders, ladder, budget,
photos/yearbook) · Pro $19.99 (garage, sponsors, studio, microsite) · Tower
$49+ (operators). Enforced in `worker/lib/entitlements.ts`.

## 9. Roadmap / open threads

- Seed beginner events per sector (BMX/drag have none pre-discovery).
- Crew review UI (endpoints exist; needs an admin surface).
- Rate-limit public discovery trigger.
- Crawler → `browser` binding (drop REST token; we're on Cloudflare).
- Rider/racer directory — third leg of "crews, events, racers" data.
- Drop in remaining keys (Perplexity, Civic, Speedhive, Stripe, VAPID, Resend,
  Lulu) to light up live engines.
- Yearbook PDF fulfillment.

## 10. The thesis, restated

Get the **on-ramp** right and families arrive. Serve them well and they log
their riders, results, and crews. Do that across every sector and region and
inmotu holds **the definitive map of American grassroots motorsports — tracks,
events, clubs, and racers** — data nobody else has. That dataset is the company.
