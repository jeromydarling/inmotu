import { Hono } from "hono";
import type { Env, Vars } from "../types";

// Public venue canvas API. The national map's data source — lightweight pins,
// viewport-bounded and category-filtered so it stays fast even with thousands
// of venues. No auth: this is the public showcase.
const venues = new Hono<{ Bindings: Env; Variables: Vars }>();

// GET /api/venues?bbox=minLng,minLat,maxLng,maxLat&category=&q=&limit=
// Returns minimal fields for map rendering. bbox is optional (omit for all).
venues.get("/", async (c) => {
  const { bbox, category, status, q } = c.req.query();
  const limit = Math.min(Number(c.req.query("limit")) || 5000, 10000);
  const where: string[] = [];
  const binds: unknown[] = [];

  if (bbox) {
    const parts = bbox.split(",").map(Number);
    if (parts.length === 4 && parts.every((n) => Number.isFinite(n))) {
      const [minLng, minLat, maxLng, maxLat] = parts;
      where.push("lng BETWEEN ? AND ? AND lat BETWEEN ? AND ?");
      binds.push(minLng, maxLng, minLat, maxLat);
    }
  }
  if (category) {
    const cats = category.split(",").map((s) => s.trim()).filter(Boolean);
    if (cats.length) {
      where.push(`category IN (${cats.map(() => "?").join(",")})`);
      binds.push(...cats);
    }
  }
  if (status) (where.push("status = ?"), binds.push(status));
  if (q) (where.push("name LIKE ?"), binds.push(`%${q}%`));
  if (c.req.query("beginner") === "1") where.push("beginner_friendly = 1");

  const sql = `
    SELECT id, name, category, surface, city, state, lat, lng, website, status,
           beginner_friendly, starter_note
    FROM venues
    ${where.length ? "WHERE " + where.join(" AND ") : ""}
    LIMIT ?`;
  const { results } = await c.env.DB.prepare(sql).bind(...binds, limit).all();
  return c.json({ venues: results });
});

// GET /api/venues/stats — counts by category + state coverage, for the map HUD.
venues.get("/stats", async (c) => {
  const byCat = await c.env.DB.prepare(
    "SELECT category, COUNT(*) AS n FROM venues GROUP BY category ORDER BY n DESC",
  ).all();
  const totals = await c.env.DB.prepare(
    "SELECT COUNT(*) AS total, COUNT(DISTINCT state) AS states FROM venues",
  ).first<{ total: number; states: number }>();
  return c.json({
    total: totals?.total ?? 0,
    states: totals?.states ?? 0,
    byCategory: byCat.results,
  });
});

// GET /api/venues/:id — a single venue with full detail + (via its linked
// track) any upcoming events, so the canvas drawer can show "racing here next".
venues.get("/:id", async (c) => {
  const v = await c.env.DB.prepare("SELECT * FROM venues WHERE id = ?")
    .bind(c.req.param("id"))
    .first<Record<string, any>>();
  if (!v) return c.json({ error: "Venue not found" }, 404);

  let events: unknown[] = [];
  if (v.track_id) {
    const r = await c.env.DB.prepare(
      `SELECT slug, title, discipline, starts_at,
              EXISTS(SELECT 1 FROM race_sessions rs WHERE rs.event_id = events.id AND rs.status='running') AS live
       FROM events
       WHERE track_id = ? AND needs_review = 0 AND demo = 0 AND starts_at >= ?
       ORDER BY starts_at ASC LIMIT 8`,
    )
      .bind(v.track_id, Math.floor(Date.now() / 1000) - 86400)
      .all();
    events = r.results;
  }

  return c.json({
    venue: {
      ...v,
      disciplines: v.disciplines ? JSON.parse(v.disciplines) : [],
      tags: v.tags ? JSON.parse(v.tags) : {},
    },
    events,
  });
});

export default venues;
