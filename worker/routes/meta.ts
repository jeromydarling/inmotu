import { Hono } from "hono";
import type { Env, Vars } from "../types";

// Reference data + lightweight platform stats for the landing page.
const meta = new Hono<{ Bindings: Env; Variables: Vars }>();

meta.get("/reference", async (c) => {
  const [disciplines, bodies, regions] = await Promise.all([
    c.env.DB.prepare("SELECT slug, label, kind FROM disciplines ORDER BY label").all(),
    c.env.DB.prepare("SELECT slug, label FROM sanctioning_bodies ORDER BY label").all(),
    c.env.DB.prepare(
      "SELECT DISTINCT region FROM events WHERE region IS NOT NULL ORDER BY region",
    ).all(),
  ]);
  return c.json({
    disciplines: disciplines.results,
    bodies: bodies.results,
    regions: regions.results.map((r) => (r as { region: string }).region),
  });
});

// Public runtime config for the SPA (e.g. the Mapbox publishable token).
meta.get("/config", (c) =>
  c.json({
    mapbox_token: c.env.MAPBOX_TOKEN ?? null,
    app_url: c.env.APP_URL,
  }),
);

meta.get("/stats", async (c) => {
  const row = await c.env.DB.prepare(
    `SELECT
       (SELECT COUNT(*) FROM events WHERE starts_at >= unixepoch() - 86400) AS upcoming_events,
       (SELECT COUNT(*) FROM tracks) AS tracks,
       (SELECT COUNT(*) FROM legislation WHERE status IN ('introduced','committee','passed')) AS active_bills,
       (SELECT COUNT(*) FROM legislation WHERE status = 'enacted') AS enacted_bills`,
  ).first();
  return c.json({ stats: row });
});

export default meta;
