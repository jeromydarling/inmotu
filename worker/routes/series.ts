import { Hono } from "hono";
import type { Env, Vars } from "../types";
import { requireAuth } from "../auth/middleware";
import { now, uid } from "../lib/util";

// Series points & standings. Public read; operators manage their own series.
const series = new Hono<{ Bindings: Env; Variables: Vars }>();

// Standard points-by-position table (MX/club style); linear fallback after 20.
const POINTS = [0, 25, 22, 20, 18, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
const pointsFor = (pos: number) => (pos >= 1 && pos < POINTS.length ? POINTS[pos] : 1);

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) + "-" + Math.random().toString(36).slice(2, 5);
}

// Public: list series
series.get("/", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT s.*, (SELECT COUNT(*) FROM series_events se WHERE se.series_id = s.id) AS rounds
     FROM series s ORDER BY s.season DESC, s.name ASC`,
  ).all();
  return c.json({ series: results });
});

// Public: standings for a series (aggregated points across rounds).
series.get("/:slug/standings", async (c) => {
  const s = await c.env.DB.prepare("SELECT * FROM series WHERE slug = ?")
    .bind(c.req.param("slug"))
    .first<Record<string, any>>();
  if (!s) return c.json({ error: "Series not found" }, 404);

  const { results } = await c.env.DB.prepare(
    `SELECT r.competitor, r.race_class,
            SUM(r.points) AS points,
            COUNT(*) AS rounds,
            MIN(r.position) AS best
     FROM results r
     WHERE r.event_id IN (SELECT event_id FROM series_events WHERE series_id = ?)
     GROUP BY r.competitor, r.race_class
     ORDER BY points DESC`,
  )
    .bind(s.id)
    .all();
  return c.json({ series: s, standings: results });
});

series.use("*", requireAuth);

// Operator: create a series
series.post("/", async (c) => {
  const b = await c.req.json().catch(() => ({}));
  if (!b.name) return c.json({ error: "name required" }, 400);
  const id = uid("ser_");
  await c.env.DB.prepare(
    `INSERT INTO series (id, slug, name, discipline, season, operator_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, slugify(b.name), b.name, b.discipline ?? null, Number(b.season) || new Date().getFullYear(), c.var.user!.id, now())
    .run();
  const row = await c.env.DB.prepare("SELECT * FROM series WHERE id = ?").bind(id).first();
  return c.json({ series: row }, 201);
});

series.get("/mine/list", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT s.*, (SELECT COUNT(*) FROM series_events se WHERE se.series_id = s.id) AS rounds
     FROM series s WHERE s.operator_id = ? ORDER BY s.created_at DESC`,
  )
    .bind(c.var.user!.id)
    .all();
  return c.json({ series: results });
});

// Operator: attach one of their events to a series as a round.
series.post("/:id/rounds", async (c) => {
  const b = await c.req.json().catch(() => ({}));
  const owns = await c.env.DB.prepare("SELECT 1 FROM series WHERE id = ? AND operator_id = ?")
    .bind(c.req.param("id"), c.var.user!.id)
    .first();
  if (!owns) return c.json({ error: "Not found" }, 404);
  if (!b.event_id) return c.json({ error: "event_id required" }, 400);
  await c.env.DB.prepare(
    "INSERT OR IGNORE INTO series_events (series_id, event_id) VALUES (?, ?)",
  )
    .bind(c.req.param("id"), b.event_id)
    .run();
  return c.json({ ok: true });
});

// Operator: post results for one of their events (auto-computes points).
series.post("/results/:eventId", async (c) => {
  const eventId = c.req.param("eventId");
  const owns = await c.env.DB.prepare("SELECT 1 FROM events WHERE id = ? AND operator_id = ?")
    .bind(eventId, c.var.user!.id)
    .first();
  if (!owns) return c.json({ error: "Event not found" }, 404);
  const b = await c.req.json().catch(() => ({}));
  const entries: any[] = Array.isArray(b.results) ? b.results : [];
  if (entries.length === 0) return c.json({ error: "results[] required" }, 400);

  // replace existing results for this event
  await c.env.DB.prepare("DELETE FROM results WHERE event_id = ?").bind(eventId).run();
  const stmts = entries
    .filter((e) => e.competitor && e.position)
    .map((e) =>
      c.env.DB.prepare(
        `INSERT INTO results (id, event_id, competitor, race_class, position, points, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).bind(uid("res_"), eventId, String(e.competitor), e.race_class ?? null, Number(e.position), pointsFor(Number(e.position)), now()),
    );
  await c.env.DB.batch(stmts);
  return c.json({ ok: true, count: stmts.length });
});

export default series;
