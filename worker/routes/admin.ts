import { Hono } from "hono";
import type { Env, Vars } from "../types";
import { ingestEvents, ingestFromFeeds, type FeedEvent } from "../ingest";
import { requireRole } from "../auth/middleware";
import { ensureDiscovered, getCrews } from "../lib/discovery";
import { refreshLegislation, refreshDiscoveredEvents } from "../lib/perplexity";
import { crawlSources, type CrawlSource } from "../lib/crawl";
import { importOsmVenues, enrichVenues, linkVenuesToTracks } from "../lib/venues";
import { budgetStatus } from "../lib/budget";

// Admin tools — manual event ingestion (same engine the Cron Trigger runs).
const admin = new Hono<{ Bindings: Env; Variables: Vars }>();

admin.use("*", requireRole("admin"));

// Import events directly, or kick the configured feeds.
admin.post("/ingest", async (c) => {
  const b = await c.req.json().catch(() => ({}));
  if (Array.isArray(b.events)) {
    const r = await ingestEvents(c.env, b.events as FeedEvent[], b.source ?? "manual-import");
    return c.json({ ok: true, ...r });
  }
  const report = await ingestFromFeeds(c.env);
  return c.json({ ok: true, feeds: report });
});

// Refresh live legislation via Perplexity (optionally limit to ?states=MN,IA).
admin.post("/refresh-legislation", async (c) => {
  const b = await c.req.json().catch(() => ({}));
  const states = Array.isArray(b.states) ? b.states : undefined;
  const r = await refreshLegislation(c.env, states);
  return c.json({ ok: true, ...r, configured: !!c.env.PERPLEXITY_API_KEY });
});

// Discover events via Perplexity for given regions (flagged needs_review).
admin.post("/discover-events", async (c) => {
  const b = await c.req.json().catch(() => ({}));
  const regions: string[] = Array.isArray(b.regions) && b.regions.length
    ? b.regions
    : ["Minnesota", "Wisconsin", "Iowa"];
  const r = await refreshDiscoveredEvents(c.env, regions);
  return c.json({ ok: true, ...r, configured: !!c.env.PERPLEXITY_API_KEY });
});

// Crawl web sources into reviewable events. Body { sources:[{url,region?,
// discipline?,provider?}] } overrides the configured CRAWL_SOURCES.
admin.post("/crawl", async (c) => {
  const b = await c.req.json().catch(() => ({}));
  const sources: CrawlSource[] | undefined = Array.isArray(b.sources) ? b.sources : undefined;
  const r = await crawlSources(c.env, sources);
  return c.json({
    ok: true,
    ...r,
    providers: {
      browser: !!(c.env.CLOUDFLARE_ACCOUNT_ID && c.env.CLOUDFLARE_API_TOKEN),
      firecrawl: !!c.env.FIRECRAWL_API_KEY,
    },
  });
});

// Import the national venue canvas from OpenStreetMap (Overpass). Idempotent;
// safe to re-run. This is what fills the map coast-to-coast.
admin.post("/import-venues", async (c) => {
  const r = await importOsmVenues(c.env);
  return c.json({ ok: !r.error, ...r });
});

// Enrich venues via Perplexity (summary/disciplines/season/website). Optional
// { limit } controls how many per call.
admin.post("/enrich-venues", async (c) => {
  const b = await c.req.json().catch(() => ({}));
  const r = await enrichVenues(c.env, typeof b.limit === "number" ? b.limit : undefined);
  return c.json({ ok: true, ...r });
});

// Auto-link venues to curated tracks by geo-proximity (surfaces events).
admin.post("/link-venues", async (c) => {
  const r = await linkVenuesToTracks(c.env);
  return c.json({ ok: true, ...r });
});

// Approve / reject AI-discovered events.
admin.post("/events/:id/review", async (c) => {
  const b = await c.req.json().catch(() => ({}));
  if (b.approve) {
    await c.env.DB.prepare("UPDATE events SET needs_review = 0 WHERE id = ?").bind(c.req.param("id")).run();
  } else {
    await c.env.DB.prepare("DELETE FROM events WHERE id = ? AND needs_review = 1").bind(c.req.param("id")).run();
  }
  return c.json({ ok: true });
});


// On-demand discovery for a sector+state (beginner events + local crews via
// Perplexity, cached). Admin trigger; the public Start page also warms this.
admin.post("/discover/:sector/:state", async (c) => {
  const r = await ensureDiscovered(c.env, c.req.param("sector"), c.req.param("state").toUpperCase());
  return c.json({ ok: true, ...r, configured: !!c.env.PERPLEXITY_API_KEY });
});

// List crews for review (sector+state), including unverified.
admin.get("/crews/:sector/:state", async (c) => {
  const crews = await getCrews(c.env, c.req.param("sector"), c.req.param("state").toUpperCase(), true);
  return c.json({ crews });
});

// Verify (approve) or reject an AI-found crew. Verifying clears the review gate.
admin.post("/crews/:id/review", async (c) => {
  const b = await c.req.json().catch(() => ({}));
  if (b.approve) {
    await c.env.DB.prepare("UPDATE crews SET needs_review = 0, verified = 1 WHERE id = ?").bind(c.req.param("id")).run();
  } else {
    await c.env.DB.prepare("DELETE FROM crews WHERE id = ?").bind(c.req.param("id")).run();
  }
  return c.json({ ok: true });
});

// Cost dashboard: today's spend vs cap per paid API, which engines are
// configured, and pending review queues. Powers the admin Control panel.
admin.get("/cost", async (c) => {
  const budgets = await budgetStatus(c.env);
  const pendingEvents = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM events WHERE needs_review = 1")
    .first<{ n: number }>();
  const pendingCrews = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM crews WHERE needs_review = 1")
    .first<{ n: number }>();
  return c.json({
    budgets,
    pending: { events: pendingEvents?.n ?? 0, crews: pendingCrews?.n ?? 0 },
    engines: {
      perplexity: !!c.env.PERPLEXITY_API_KEY,
      civic: !!c.env.GOOGLE_CIVIC_API_KEY,
      speedhive: !!c.env.SPEEDHIVE_API_KEY,
      firecrawl: !!c.env.FIRECRAWL_API_KEY,
      browser: !!(c.env.CLOUDFLARE_ACCOUNT_ID && c.env.CLOUDFLARE_API_TOKEN),
      mapbox: !!c.env.MAPBOX_TOKEN,
    },
  });
});

export default admin;
