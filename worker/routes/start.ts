import { Hono } from "hono";
import type { Env, Vars } from "../types";
import { now } from "../lib/util";

// The newcomer on-ramp. Public. For a curious family exploring a sector, return
// the easy first steps near them: beginner-friendly tracks + upcoming try-it /
// beginner-level events. Sector → disciplines mapping mirrors shared SECTORS.
const start = new Hono<{ Bindings: Env; Variables: Vars }>();

// sector id → venue categories + event discipline slugs (kept in sync with
// shared/types.ts SECTORS; small + stable enough to inline on the edge).
const SECTOR_MAP: Record<string, { categories: string[]; disciplines: string[] }> = {
  motocross: { categories: ["motocross"], disciplines: ["motocross", "off-road"] },
  bmx: { categories: ["bmx"], disciplines: ["bmx"] },
  drag: { categories: ["drag"], disciplines: ["drag"] },
  karting_sprint: { categories: ["karting", "road"], disciplines: ["karting"] },
  karting_dirt: { categories: ["karting", "oval"], disciplines: ["karting", "short-track"] },
  roadrace: { categories: ["road"], disciplines: ["road-race", "endurance"] },
  autocross: { categories: ["road"], disciplines: ["autocross"] },
};

// GET /api/start/:sector — beginner venues + beginner/try-it events for a sector.
start.get("/:sector", async (c) => {
  const sector = c.req.param("sector");
  const map = SECTOR_MAP[sector];
  if (!map) return c.json({ error: "Unknown sector" }, 404);

  // Beginner-friendly venues in this sector's categories.
  const catPlaceholders = map.categories.map(() => "?").join(",");
  const venues = await c.env.DB.prepare(
    `SELECT id, name, category, city, state, lat, lng, website, starter_note
     FROM venues
     WHERE beginner_friendly = 1 AND category IN (${catPlaceholders})
     ORDER BY state, name LIMIT 50`,
  )
    .bind(...map.categories)
    .all();

  // Upcoming beginner-level events in this sector's disciplines.
  const discPlaceholders = map.disciplines.map(() => "?").join(",");
  const events = await c.env.DB.prepare(
    `SELECT e.slug, e.title, e.discipline, e.level, e.starts_at,
            t.name AS track_name, t.city AS track_city, t.state AS track_state
     FROM events e LEFT JOIN tracks t ON t.id = e.track_id
     WHERE e.needs_review = 0 AND e.starts_at >= ?
       AND e.discipline IN (${discPlaceholders})
     ORDER BY (e.level = 'beginner') DESC, e.starts_at ASC
     LIMIT 12`,
  )
    .bind(now() - 86400, ...map.disciplines)
    .all();

  return c.json({ sector, venues: venues.results, events: events.results });
});

export default start;
