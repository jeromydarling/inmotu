import { Hono } from "hono";
import type { Env, Vars } from "../types";
import { ingestEvents, ingestFromFeeds, type FeedEvent } from "../ingest";
import { requireRole } from "../auth/middleware";
import { refreshLegislation, refreshDiscoveredEvents } from "../lib/perplexity";
import { crawlSources, type CrawlSource } from "../lib/crawl";

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

export default admin;
