import { Hono } from "hono";
import type { Env, Vars } from "../types";
import { now, uid } from "../lib/util";
import { requireAuth } from "../auth/middleware";
import { err } from "../lib/http";
import { ownsEvent } from "../db";
import { syncEventResults, type ResultSession } from "../lib/speedhive";

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
  // Sector scoping: ?disciplines=motocross,bmx narrows to a set (used by The
  // Grid when a user filters to their sector).
  const disciplines = c.req.query("disciplines");
  if (disciplines) {
    const list = disciplines.split(",").map((s) => s.trim()).filter(Boolean);
    if (list.length) {
      where.push(`e.discipline IN (${list.map(() => "?").join(",")})`);
      binds.push(...list);
    }
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
  // Hide fabricated demo/seed events by default — a curious family should see
  // REAL events or an honest empty state, never a made-up race.
  if (c.req.query("include_demo") !== "1") where.push("e.demo = 0");

  // "Near me": ?lat=&lng=&radius=<miles>. Bounding-box prefilter in SQL (fast,
  // index-friendly), exact haversine distance computed + sorted after.
  const lat = Number(c.req.query("lat"));
  const lng = Number(c.req.query("lng"));
  const radius = Number(c.req.query("radius")) || 100;
  const geo = Number.isFinite(lat) && Number.isFinite(lng);
  if (geo) {
    const dLat = radius / 69; // ~69 miles per degree latitude
    const dLng = radius / (69 * Math.max(0.1, Math.cos((lat * Math.PI) / 180)));
    where.push("t.lat BETWEEN ? AND ? AND t.lng BETWEEN ? AND ?");
    binds.push(lat - dLat, lat + dLat, lng - dLng, lng + dLng);
  }

  const sql = `
    SELECT e.*, t.name AS track_name, t.city AS track_city, t.state AS track_state,
           t.lat AS track_lat, t.lng AS track_lng
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

  let rows = results.map((e) => ({ ...e, saved: savedSet.has(e.id as string) }));

  // When geo-filtering, attach exact distance + sort nearest-first.
  if (geo) {
    const R = 3958.8; // earth radius, miles
    const toRad = (d: number) => (d * Math.PI) / 180;
    rows = rows
      .map((e: any) => {
        if (e.track_lat == null || e.track_lng == null) return { ...e, distance_mi: null };
        const a =
          Math.sin(toRad((e.track_lat - lat) / 1) / 2) ** 2 +
          Math.cos(toRad(lat)) * Math.cos(toRad(e.track_lat)) *
            Math.sin(toRad((e.track_lng - lng) / 1) / 2) ** 2;
        const d = 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
        return { ...e, distance_mi: Math.round(d) };
      })
      .filter((e: any) => e.distance_mi == null || e.distance_mi <= radius)
      .sort((a: any, b: any) => (a.distance_mi ?? 1e9) - (b.distance_mi ?? 1e9));
  }

  return c.json({ events: rows });
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

// GET /api/events/:slug/results — live standings (sessions + classification).
// ?refresh=1 triggers a Speedhive sync first (rate-limited by the client TTL).
events.get("/:slug/results", async (c) => {
  const ev = await c.env.DB.prepare(
    "SELECT id, title, speedhive_event_id FROM events WHERE slug = ?",
  )
    .bind(c.req.param("slug"))
    .first<{ id: string; title: string; speedhive_event_id: string | null }>();
  if (!ev) return c.json({ error: "Event not found" }, 404);

  if (c.req.query("refresh") === "1" && ev.speedhive_event_id) {
    await syncEventResults(c.env, ev.id).catch(() => {});
  }

  const { results: sessions } = await c.env.DB.prepare(
    `SELECT s.id, s.name, s.race_class, s.session_type, s.status, s.started_at, s.source, s.refreshed_at,
            (SELECT COUNT(*) FROM live_results WHERE session_id = s.id) AS entries
     FROM race_sessions s WHERE s.event_id = ?
     ORDER BY s.started_at IS NULL, s.started_at DESC, s.created_at DESC`,
  )
    .bind(ev.id)
    .all<Record<string, any>>();

  const { results: rows } = await c.env.DB.prepare(
    `SELECT lr.*, r.name AS rider_name FROM live_results lr
     LEFT JOIN riders r ON r.id = lr.rider_id
     WHERE lr.session_id IN (SELECT id FROM race_sessions WHERE event_id = ?)
     ORDER BY lr.position IS NULL, lr.position ASC`,
  )
    .bind(ev.id)
    .all<Record<string, any>>();

  const bySession = new Map<string, any[]>();
  for (const r of rows) {
    const list = bySession.get(r.session_id) ?? [];
    list.push(r);
    bySession.set(r.session_id, list);
  }

  return c.json({
    linked: !!ev.speedhive_event_id,
    sessions: sessions.map((s) => ({ ...s, rows: bySession.get(s.id) ?? [] })),
  });
});

// POST /api/events/:id/speedhive — operator/admin links the event to Speedhive.
events.post("/:id/speedhive", requireAuth, async (c) => {
  const id = c.req.param("id");
  if (c.var.user!.role !== "admin" && !(await ownsEvent(c.env, id, c.var.user!.id)))
    return err(c, "not_found", "Event not found");
  const b = await c.req.json().catch(() => ({}));
  await c.env.DB.prepare(
    "UPDATE events SET speedhive_event_id = ?, speedhive_org_id = ? WHERE id = ?",
  )
    .bind(b.speedhive_event_id ? String(b.speedhive_event_id) : null, b.speedhive_org_id ? String(b.speedhive_org_id) : null, id)
    .run();
  return c.json({ ok: true });
});

// POST /api/events/:id/results/sync — operator/admin. Pull from Speedhive, or
// upsert a manually-entered { sessions:[{name,race_class,rows:[...]}] } payload.
events.post("/:id/results/sync", requireAuth, async (c) => {
  const id = c.req.param("id");
  if (c.var.user!.role !== "admin" && !(await ownsEvent(c.env, id, c.var.user!.id)))
    return err(c, "not_found", "Event not found");
  const b = await c.req.json().catch(() => ({}));
  const injected: ResultSession[] | undefined = Array.isArray(b.sessions)
    ? b.sessions.map((s: any) => ({
        source_session_id: s.source_session_id ?? null,
        name: String(s.name ?? "Session"),
        race_class: s.race_class ?? undefined,
        session_type: s.session_type ?? undefined,
        status: s.status ?? undefined,
        started_at: s.started_at ?? undefined,
        rows: Array.isArray(s.rows) ? s.rows : [],
      }))
    : undefined;
  const r = await syncEventResults(c.env, id, injected);
  return c.json({ ok: true, ...r });
});

export default events;
