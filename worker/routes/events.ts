import { Hono } from "hono";
import type { Env, Vars } from "../types";
import { now, uid } from "../lib/util";

const events = new Hono<{ Bindings: Env; Variables: Vars }>();

// GET /api/events — filterable feed (The Grid)
events.get("/", async (c) => {
  const { discipline, region, level, q, from } = c.req.query();
  const where: string[] = [];
  const binds: unknown[] = [];

  if (discipline) {
    where.push("e.discipline = ?");
    binds.push(discipline);
  }
  if (region) {
    where.push("e.region = ?");
    binds.push(region);
  }
  if (level) {
    where.push("e.level = ?");
    binds.push(level);
  }
  if (q) {
    where.push("(e.title LIKE ? OR t.name LIKE ?)");
    binds.push(`%${q}%`, `%${q}%`);
  }
  // default: upcoming events only
  where.push("e.starts_at >= ?");
  binds.push(from ? Number(from) : now() - 86400);

  const sql = `
    SELECT e.*, t.name AS track_name, t.city AS track_city, t.state AS track_state
    FROM events e LEFT JOIN tracks t ON t.id = e.track_id
    ${where.length ? "WHERE " + where.join(" AND ") : ""}
    ORDER BY e.starts_at ASC LIMIT 200`;

  const { results } = await c.env.DB.prepare(sql)
    .bind(...binds)
    .all();

  // annotate saved state for signed-in users
  let savedSet = new Set<string>();
  if (c.var.user) {
    const saved = await c.env.DB.prepare(
      "SELECT event_id FROM saved_events WHERE user_id = ?",
    )
      .bind(c.var.user.id)
      .all<{ event_id: string }>();
    savedSet = new Set(saved.results.map((r) => r.event_id));
  }

  return c.json({
    events: results.map((e) => ({ ...e, saved: savedSet.has(e.id as string) })),
  });
});

// GET /api/events/:slug — detail
events.get("/:slug", async (c) => {
  const slug = c.req.param("slug");
  const e = await c.env.DB.prepare(
    `SELECT e.*, t.name AS track_name, t.city AS track_city, t.state AS track_state,
            t.slug AS track_slug, t.lat AS track_lat, t.lng AS track_lng
     FROM events e LEFT JOIN tracks t ON t.id = e.track_id
     WHERE e.slug = ?`,
  )
    .bind(slug)
    .first();
  if (!e) return c.json({ error: "Event not found" }, 404);

  let saved = false;
  if (c.var.user) {
    const row = await c.env.DB.prepare(
      "SELECT 1 FROM saved_events WHERE user_id = ? AND event_id = ?",
    )
      .bind(c.var.user.id, e.id)
      .first();
    saved = !!row;
  }
  return c.json({ event: { ...e, saved } });
});

// POST /api/events/:id/save — toggle save (auth)
events.post("/:id/save", async (c) => {
  if (!c.var.user) return c.json({ error: "Authentication required" }, 401);
  const id = c.req.param("id");
  const exists = await c.env.DB.prepare(
    "SELECT 1 FROM saved_events WHERE user_id = ? AND event_id = ?",
  )
    .bind(c.var.user.id, id)
    .first();
  if (exists) {
    await c.env.DB.prepare(
      "DELETE FROM saved_events WHERE user_id = ? AND event_id = ?",
    )
      .bind(c.var.user.id, id)
      .run();
    return c.json({ saved: false });
  }
  await c.env.DB.prepare(
    "INSERT INTO saved_events (user_id, event_id, reminder, created_at) VALUES (?, ?, 1, ?)",
  )
    .bind(c.var.user.id, id, now())
    .run();
  return c.json({ saved: true });
});

// GET /api/events/saved/mine — user's calendar
events.get("/saved/mine", async (c) => {
  if (!c.var.user) return c.json({ error: "Authentication required" }, 401);
  const { results } = await c.env.DB.prepare(
    `SELECT e.*, t.name AS track_name, t.city AS track_city, t.state AS track_state
     FROM saved_events s
     JOIN events e ON e.id = s.event_id
     LEFT JOIN tracks t ON t.id = e.track_id
     WHERE s.user_id = ? ORDER BY e.starts_at ASC`,
  )
    .bind(c.var.user.id)
    .all();
  return c.json({ events: results.map((e) => ({ ...e, saved: true })) });
});

export default events;
