import { Hono } from "hono";
import type { Env, Vars } from "../types";
import { now, uid } from "../lib/util";
import { requireAuth } from "../auth/middleware";
import { err } from "../lib/http";

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
  // Hide AI-discovered events pending review unless explicitly included.
  if (c.req.query("include_unverified") !== "1") where.push("e.needs_review = 0");

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

// POST /api/events/:id/save — toggle save (auth). Atomic: INSERT OR IGNORE,
// then if nothing was inserted the row already existed → DELETE (unsave).
events.post("/:id/save", requireAuth, async (c) => {
  const id = c.req.param("id");
  const ins = await c.env.DB.prepare(
    "INSERT OR IGNORE INTO saved_events (user_id, event_id, reminder, created_at) VALUES (?, ?, 1, ?)",
  )
    .bind(c.var.user!.id, id, now())
    .run();
  if (ins.meta.changes > 0) return c.json({ saved: true });

  await c.env.DB.prepare("DELETE FROM saved_events WHERE user_id = ? AND event_id = ?")
    .bind(c.var.user!.id, id)
    .run();
  return c.json({ saved: false });
});

// GET /api/events/saved/mine — user's calendar
events.get("/saved/mine", requireAuth, async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT e.*, t.name AS track_name, t.city AS track_city, t.state AS track_state
     FROM saved_events s
     JOIN events e ON e.id = s.event_id
     LEFT JOIN tracks t ON t.id = e.track_id
     WHERE s.user_id = ? ORDER BY e.starts_at ASC`,
  )
    .bind(c.var.user!.id)
    .all();
  return c.json({ events: results.map((e) => ({ ...e, saved: true })) });
});

// POST /api/events/:id/register — a family registers a rider (auth)
events.post("/:id/register", requireAuth, async (c) => {
  const id = c.req.param("id");
  const b = await c.req.json().catch(() => ({}));
  if (typeof b.rider_name !== "string" || !b.rider_name.trim())
    return err(c, "validation", "rider_name required");

  const ev = await c.env.DB.prepare(
    "SELECT id, entry_fee_cents FROM events WHERE id = ?",
  )
    .bind(id)
    .first<{ id: string; entry_fee_cents: number | null }>();
  if (!ev) return err(c, "not_found", "Event not found");

  try {
    await c.env.DB.prepare(
      `INSERT INTO registrations (id, event_id, user_id, rider_id, rider_name, race_class, status, amount_cents, travel_miles, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'confirmed', ?, ?, ?)`,
    )
      .bind(
        uid("reg_"),
        id,
        c.var.user!.id,
        b.rider_id ?? null,
        b.rider_name.trim(),
        b.race_class ?? null,
        ev.entry_fee_cents,
        typeof b.travel_miles === "number" ? b.travel_miles : null,
        now(),
      )
      .run();
  } catch {
    return err(c, "conflict", "Rider already registered for this event");
  }
  return c.json({ ok: true }, 201);
});

// GET /api/events/registrations/mine — the family's registrations (auth)
events.get("/registrations/mine", requireAuth, async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT r.id, r.rider_name, r.race_class, r.status, r.amount_cents,
            e.slug AS event_slug, e.title AS event_title, e.starts_at
     FROM registrations r JOIN events e ON e.id = r.event_id
     WHERE r.user_id = ? ORDER BY e.starts_at ASC`,
  )
    .bind(c.var.user!.id)
    .all();
  return c.json({ registrations: results });
});

export default events;
