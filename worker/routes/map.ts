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
     WHERE e.needs_review = 0 AND e.demo = 0 AND tr.lat IS NOT NULL AND tr.lng IS NOT NULL
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

// Public headline stats — real aggregates for the landing "by the numbers"
// band and hero. Cached ~5 min in ai_cache to keep it cheap.
map.get("/stats", async (c) => {
  const cached = await c.env.DB.prepare("SELECT payload, refreshed_at FROM ai_cache WHERE key = 'stats:public'")
    .first<{ payload: string; refreshed_at: number }>();
  if (cached && now() - cached.refreshed_at < 300) {
    return c.json(JSON.parse(cached.payload));
  }

  const t = now();
  const one = async (sql: string, ...binds: unknown[]) =>
    Number((await c.env.DB.prepare(sql).bind(...binds).first<{ n: number }>())?.n ?? 0);

  const [
    eventsUpcoming,
    tracksTotal,
    statesCovered,
    disciplines,
    endangered,
    legStates,
    lawsEnacted,
    billsActive,
    supporters,
    resultsRecorded,
    liveNow,
  ] = await Promise.all([
    one("SELECT COUNT(*) n FROM events WHERE starts_at >= ?", t - 86400),
    one("SELECT COUNT(*) n FROM tracks"),
    one("SELECT COUNT(DISTINCT state) n FROM tracks WHERE state IS NOT NULL"),
    one("SELECT COUNT(DISTINCT discipline) n FROM events WHERE discipline IS NOT NULL"),
    one("SELECT COUNT(*) n FROM tracks WHERE status = 'endangered'"),
    one("SELECT COUNT(DISTINCT state) n FROM legislation"),
    one("SELECT COUNT(*) n FROM legislation WHERE status = 'enacted'"),
    one("SELECT COUNT(*) n FROM legislation WHERE status IN ('introduced','committee','passed')"),
    one("SELECT COUNT(*) n FROM advocacy_actions"),
    one("SELECT COUNT(*) n FROM live_results"),
    one("SELECT COUNT(DISTINCT event_id) n FROM race_sessions WHERE status = 'running'"),
  ]);

  const payload = {
    eventsUpcoming,
    tracksTotal,
    statesCovered,
    disciplines,
    endangered,
    legStates,
    lawsEnacted,
    billsActive,
    supporters,
    resultsRecorded,
    liveNow,
  };
  await c.env.DB.prepare(
    "INSERT OR REPLACE INTO ai_cache (key, payload, refreshed_at) VALUES ('stats:public', ?, ?)",
  )
    .bind(JSON.stringify(payload), now())
    .run();
  return c.json(payload);
});

export default map;
