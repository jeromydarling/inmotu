import { Hono } from "hono";
import type { Env, Vars } from "../types";
import { now } from "../lib/util";
import { ensureDiscovered, getCrews } from "../lib/discovery";

// The newcomer on-ramp. Public. For a curious family exploring a sector in a
// state, return the easy first steps: beginner-friendly tracks, upcoming
// beginner events, AND local crews/clubs to connect with — pulling live from
// Perplexity on demand (cached) when a state is specified.
const start = new Hono<{ Bindings: Env; Variables: Vars }>();

const SECTOR_MAP: Record<string, { categories: string[]; disciplines: string[] }> = {
  motocross: { categories: ["motocross"], disciplines: ["motocross", "off-road"] },
  bmx: { categories: ["bmx"], disciplines: ["bmx"] },
  drag: { categories: ["drag"], disciplines: ["drag"] },
  karting_sprint: { categories: ["karting", "road"], disciplines: ["karting"] },
  karting_dirt: { categories: ["karting", "oval"], disciplines: ["karting", "short-track"] },
  roadrace: { categories: ["road"], disciplines: ["road-race", "endurance"] },
  autocross: { categories: ["road"], disciplines: ["autocross"] },
};

// GET /api/start/:sector?state=GA — beginner venues + events (+ crews when a
// state is given and discovery is configured).
start.get("/:sector", async (c) => {
  const sector = c.req.param("sector");
  const map = SECTOR_MAP[sector];
  if (!map) return c.json({ error: "Unknown sector" }, 404);
  const state = (c.req.query("state") ?? "").slice(0, 2).toUpperCase();

  // On-demand discovery for this slice (cached ~3 weeks; no-op without a key).
  let discovery = { ran: false, events: 0, crews: 0 };
  if (state) {
    discovery = await ensureDiscovered(c.env, sector, state).catch(() => discovery);
  }

  const catPlaceholders = map.categories.map(() => "?").join(",");
  const venues = await c.env.DB.prepare(
    `SELECT id, name, category, city, state, lat, lng, website, starter_note
     FROM venues
     WHERE beginner_friendly = 1 AND category IN (${catPlaceholders})
     ${state ? "AND state = ?" : ""}
     ORDER BY state, name LIMIT 50`,
  )
    .bind(...map.categories, ...(state ? [state] : []))
    .all();

  const discPlaceholders = map.disciplines.map(() => "?").join(",");
  const events = await c.env.DB.prepare(
    `SELECT e.slug, e.title, e.discipline, e.level, e.starts_at, e.source, e.needs_review,
            t.name AS track_name, t.city AS track_city, t.state AS track_state
     FROM events e LEFT JOIN tracks t ON t.id = e.track_id
     WHERE e.starts_at >= ?
       AND e.discipline IN (${discPlaceholders})
       ${state ? "AND (t.state = ? OR e.region = ?)" : ""}
     ORDER BY (e.level = 'beginner') DESC, e.starts_at ASC
     LIMIT 16`,
  )
    .bind(now() - 86400, ...map.disciplines, ...(state ? [state, state] : []))
    .all();

  const crews = state ? await getCrews(c.env, sector, state, true) : [];

  return c.json({
    sector,
    state: state || null,
    venues: venues.results,
    events: events.results,
    crews,
    discovery: { configured: !!c.env.PERPLEXITY_API_KEY, ...discovery },
  });
});

export default start;
