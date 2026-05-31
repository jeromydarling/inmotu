import { Hono } from "hono";
import type { Env, Vars } from "../types";
import { now } from "../lib/util";

// Public map data — powers the landing hero mini-map and is a lightweight
// single call for "where the racing is" + "where the battles are".
const map = new Hono<{ Bindings: Env; Variables: Vars }>();

map.get("/pins", async (c) => {
  const t = now();

  // Upcoming events that have track coordinates, with a live-now flag.
  const events = await c.env.DB.prepare(
    `SELECT e.slug, e.title, e.discipline, e.starts_at,
            tr.lat, tr.lng, tr.name AS track_name,
            EXISTS(SELECT 1 FROM race_sessions rs WHERE rs.event_id = e.id AND rs.status = 'running') AS live
     FROM events e JOIN tracks tr ON tr.id = e.track_id
     WHERE e.needs_review = 0 AND tr.lat IS NOT NULL AND tr.lng IS NOT NULL
       AND e.starts_at BETWEEN ? AND ?
     ORDER BY e.starts_at ASC LIMIT 300`,
  )
    .bind(t - 86400, t + 90 * 86400)
    .all();

  // Endangered tracks (precise points) — the front line.
  const endangered = await c.env.DB.prepare(
    `SELECT t.slug, t.name, t.state, t.lat, t.lng, th.threat_type
     FROM tracks t LEFT JOIN track_threats th ON th.track_id = t.id
     WHERE t.status = 'endangered' AND t.lat IS NOT NULL AND t.lng IS NOT NULL`,
  ).all();

  // Right-to-Race legislation aggregated by state (frontend maps to centroids).
  const legislation = await c.env.DB.prepare(
    `SELECT state, state_name,
            SUM(CASE WHEN status = 'enacted' THEN 1 ELSE 0 END) AS enacted,
            SUM(CASE WHEN status IN ('introduced','committee','passed') THEN 1 ELSE 0 END) AS active,
            COUNT(*) AS total
     FROM legislation
     WHERE source = 'perplexity'
        OR state NOT IN (SELECT DISTINCT state FROM legislation WHERE source = 'perplexity')
     GROUP BY state, state_name`,
  ).all();

  return c.json({
    events: events.results,
    endangered: endangered.results,
    legislation: legislation.results,
  });
});

export default map;
