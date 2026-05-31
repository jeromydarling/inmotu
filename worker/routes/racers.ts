import { Hono } from "hono";
import type { Env, Vars } from "../types";

// Public racer directory — the third leg of the data moat. Only riders a family
// has OPTED IN (published = 1) appear here. Privacy-first: no email, no
// birthdate, no precise address ever exposed; just the public racing identity.
const racers = new Hono<{ Bindings: Env; Variables: Vars }>();

// sector → discipline slugs (mirrors shared SECTORS; inlined for the edge).
const SECTOR_DISC: Record<string, string[]> = {
  motocross: ["motocross", "off-road"],
  bmx: ["bmx"],
  drag: ["drag"],
  karting_sprint: ["karting"],
  karting_dirt: ["karting", "short-track"],
  roadrace: ["road-race", "endurance"],
  autocross: ["autocross"],
};

// GET /api/racers?discipline=&sector=&state=&q=  — public, published only.
racers.get("/", async (c) => {
  const { discipline, sector, state, q } = c.req.query();
  const limit = Math.min(Number(c.req.query("limit")) || 60, 200);
  const where = ["r.published = 1", "r.slug IS NOT NULL"];
  const binds: unknown[] = [];

  if (discipline) (where.push("r.discipline = ?"), binds.push(discipline));
  else if (sector && SECTOR_DISC[sector]) {
    const ds = SECTOR_DISC[sector];
    where.push(`r.discipline IN (${ds.map(() => "?").join(",")})`);
    binds.push(...ds);
  }
  if (state) (where.push("r.hometown LIKE ?"), binds.push(`%${state}%`));
  if (q) (where.push("r.name LIKE ?"), binds.push(`%${q}%`));

  const { results } = await c.env.DB.prepare(
    `SELECT r.slug, r.name, r.number, r.discipline, r.race_class, r.skill_level,
            r.hometown, r.wins,
            (SELECT COUNT(*) FROM live_results lr WHERE lr.rider_id = r.id) AS result_count
     FROM riders r
     WHERE ${where.join(" AND ")}
     ORDER BY r.wins DESC, r.name ASC
     LIMIT ?`,
  )
    .bind(...binds, limit)
    .all();
  return c.json({ racers: results });
});

// GET /api/racers/stats — directory totals + by-discipline counts (HUD).
racers.get("/stats", async (c) => {
  const totals = await c.env.DB.prepare(
    "SELECT COUNT(*) AS total FROM riders WHERE published = 1 AND slug IS NOT NULL",
  ).first<{ total: number }>();
  const byDisc = await c.env.DB.prepare(
    "SELECT discipline, COUNT(*) AS n FROM riders WHERE published = 1 AND slug IS NOT NULL GROUP BY discipline ORDER BY n DESC",
  ).all();
  return c.json({ total: totals?.total ?? 0, byDiscipline: byDisc.results });
});

// GET /api/racers/:slug — public racer profile + results + public photos + stats.
racers.get("/:slug", async (c) => {
  const r = await c.env.DB.prepare(
    `SELECT id, slug, name, number, discipline, race_class, skill_level, wins, bio, hometown
     FROM riders WHERE slug = ? AND published = 1`,
  )
    .bind(c.req.param("slug"))
    .first<Record<string, any>>();
  if (!r) return c.json({ error: "Racer not found" }, 404);

  // Timed results across events (public — same shape as the owner view).
  const results = await c.env.DB.prepare(
    `SELECT lr.position, lr.start_number, lr.best_lap, lr.status,
            s.name AS session_name, s.race_class, s.started_at,
            e.slug AS event_slug, e.title AS event_title, e.starts_at AS event_at
     FROM live_results lr
     JOIN race_sessions s ON s.id = lr.session_id
     JOIN events e ON e.id = s.event_id
     WHERE lr.rider_id = ?
     ORDER BY COALESCE(s.started_at, e.starts_at) DESC LIMIT 30`,
  )
    .bind(r.id)
    .all();

  // Public photos only.
  const photos = await c.env.DB.prepare(
    "SELECT id, caption FROM photos WHERE rider_id = ? AND public = 1 ORDER BY created_at DESC LIMIT 12",
  )
    .bind(r.id)
    .all();

  // Computed career stats from results.
  const rows = results.results as any[];
  const podiums = rows.filter((x) => x.position != null && x.position <= 3).length;
  const wins = rows.filter((x) => x.position === 1).length;

  // Don't leak the internal rider id.
  const { id: _id, ...racer } = r;
  return c.json({
    racer,
    results: rows,
    photos: photos.results,
    stats: { events: new Set(rows.map((x) => x.event_slug)).size, results: rows.length, podiums, wins },
  });
});

export default racers;
