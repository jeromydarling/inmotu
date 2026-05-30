import { Hono } from "hono";
import type { Env, Vars } from "../types";
import { ingestEvents, ingestFromFeeds, type FeedEvent } from "../ingest";
import { requireRole } from "../auth/middleware";

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

export default admin;
