import { Hono } from "hono";
import type { Env, Vars } from "../types";
import { requireAuth } from "../auth/middleware";
import { now, uid } from "../lib/util";

// The Tower — operator tools. An operator owns the events they create and
// can see registrations + a one-click economic-impact summary.
const tower = new Hono<{ Bindings: Env; Variables: Vars }>();
tower.use("*", requireAuth);

function slugify(s: string) {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) +
    "-" +
    Math.random().toString(36).slice(2, 6)
  );
}

// Events owned by this operator
tower.get("/events", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT e.*, t.name AS track_name, t.state AS track_state,
       (SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id AND r.status != 'canceled') AS reg_count
     FROM events e LEFT JOIN tracks t ON t.id = e.track_id
     WHERE e.operator_id = ? ORDER BY e.starts_at ASC`,
  )
    .bind(c.var.user!.id)
    .all();
  return c.json({ events: results });
});

// Create an event for a track you operate
tower.post("/events", async (c) => {
  const b = await c.req.json().catch(() => ({}));
  if (typeof b.title !== "string" || !b.title.trim())
    return c.json({ error: "Event title required" }, 400);
  if (typeof b.starts_at !== "number")
    return c.json({ error: "starts_at (epoch seconds) required" }, 400);

  const id = uid("evt_");
  await c.env.DB.prepare(
    `INSERT INTO events (id, slug, title, discipline, body_slug, track_id, region, level, age_group,
       starts_at, reg_closes_at, entry_fee_cents, gate_fee_cents, source, operator_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'inmotu', ?, ?)`,
  )
    .bind(
      id,
      slugify(b.title),
      b.title.trim(),
      b.discipline ?? null,
      b.body_slug ?? "independent",
      b.track_id ?? null,
      b.region ?? null,
      b.level ?? "club",
      b.age_group ?? "all",
      b.starts_at,
      b.reg_closes_at ?? null,
      b.entry_fee_cents ?? null,
      b.gate_fee_cents ?? null,
      c.var.user!.id,
      now(),
    )
    .run();
  const row = await c.env.DB.prepare("SELECT * FROM events WHERE id = ?").bind(id).first();
  return c.json({ event: row }, 201);
});

// Registrations for an event you own, plus economic-impact rollup
tower.get("/events/:id/registrations", async (c) => {
  const id = c.req.param("id");
  const owns = await c.env.DB.prepare(
    "SELECT 1 FROM events WHERE id = ? AND operator_id = ?",
  )
    .bind(id, c.var.user!.id)
    .first();
  if (!owns) return c.json({ error: "Not found" }, 404);

  const { results } = await c.env.DB.prepare(
    `SELECT id, rider_name, race_class, status, amount_cents, travel_miles, created_at
     FROM registrations WHERE event_id = ? ORDER BY created_at DESC`,
  )
    .bind(id)
    .all();

  const impact = await c.env.DB.prepare(
    `SELECT COUNT(*) AS entries,
            COALESCE(SUM(amount_cents),0) AS gross_cents,
            COALESCE(AVG(travel_miles),0) AS avg_miles
     FROM registrations WHERE event_id = ? AND status != 'canceled'`,
  )
    .bind(id)
    .first<{ entries: number; gross_cents: number; avg_miles: number }>();

  // Simple, defensible model: avg spend per visiting entry ($340 in spec).
  const SPEND_PER_ENTRY = 34000;
  const economic_impact_cents = (impact?.entries ?? 0) * SPEND_PER_ENTRY;

  return c.json({
    registrations: results,
    impact: { ...impact, economic_impact_cents },
  });
});

export default tower;
