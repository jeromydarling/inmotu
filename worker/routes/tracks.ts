import { Hono } from "hono";
import type { Env, Vars } from "../types";

const tracks = new Hono<{ Bindings: Env; Variables: Vars }>();

function parseTrack(row: Record<string, unknown>) {
  let amenities: string[] = [];
  try {
    amenities = row.amenities ? JSON.parse(row.amenities as string) : [];
  } catch {
    amenities = [];
  }
  return { ...row, amenities };
}

tracks.get("/", async (c) => {
  const { discipline, state, status } = c.req.query();
  const where: string[] = [];
  const binds: unknown[] = [];
  if (discipline) (where.push("discipline = ?"), binds.push(discipline));
  if (state) (where.push("state = ?"), binds.push(state));
  if (status) (where.push("status = ?"), binds.push(status));
  const sql = `SELECT * FROM tracks ${
    where.length ? "WHERE " + where.join(" AND ") : ""
  } ORDER BY name ASC`;
  const { results } = await c.env.DB.prepare(sql)
    .bind(...binds)
    .all<Record<string, unknown>>();
  return c.json({ tracks: results.map(parseTrack) });
});

tracks.get("/:slug", async (c) => {
  const slug = c.req.param("slug");
  const row = await c.env.DB.prepare("SELECT * FROM tracks WHERE slug = ?")
    .bind(slug)
    .first<Record<string, unknown>>();
  if (!row) return c.json({ error: "Track not found" }, 404);

  const upcoming = await c.env.DB.prepare(
    "SELECT id, slug, title, starts_at, level, discipline FROM events WHERE track_id = ? ORDER BY starts_at ASC LIMIT 10",
  )
    .bind(row.id)
    .all();
  const threats = await c.env.DB.prepare(
    "SELECT id, threat_type, description, verified, created_at FROM track_threats WHERE track_id = ?",
  )
    .bind(row.id)
    .all();

  return c.json({
    track: parseTrack(row),
    events: upcoming.results,
    threats: threats.results,
  });
});

export default tracks;
