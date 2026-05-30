import { Hono } from "hono";
import type { Env, Vars } from "../types";
import { requireAuth } from "../auth/middleware";
import { now, uid } from "../lib/util";

// Road to the Ranch — the qualifying-ladder tracker.
const ladder = new Hono<{ Bindings: Env; Variables: Vars }>();

// Public: ladders + their stages (the structure of qualifying)
ladder.get("/", async (c) => {
  const ladders = await c.env.DB.prepare(
    "SELECT * FROM ladders ORDER BY season DESC",
  ).all();
  const stages = await c.env.DB.prepare(
    "SELECT * FROM ladder_stages ORDER BY stage_order ASC",
  ).all();
  const byLadder = (ladders.results as any[]).map((l) => ({
    ...l,
    stages: (stages.results as any[]).filter((s) => s.ladder_id === l.id),
  }));
  return c.json({ ladders: byLadder });
});

ladder.use("/rider/*", requireAuth);
ladder.use("/progress", requireAuth);
ladder.use("/progress/*", requireAuth);

// A rider's live progress through the ladder for their discipline.
ladder.get("/rider/:riderId", async (c) => {
  const riderId = c.req.param("riderId");
  const rider = await c.env.DB.prepare(
    "SELECT * FROM riders WHERE id = ? AND user_id = ?",
  )
    .bind(riderId, c.var.user!.id)
    .first<Record<string, any>>();
  if (!rider) return c.json({ error: "Rider not found" }, 404);

  // Pick the most recent ladder matching the rider's discipline.
  const lad = await c.env.DB.prepare(
    "SELECT * FROM ladders WHERE discipline = ? ORDER BY season DESC LIMIT 1",
  )
    .bind(rider.discipline ?? "motocross")
    .first<Record<string, any>>();

  if (!lad) return c.json({ rider, ladder: null, stages: [] });

  const stages = await c.env.DB.prepare(
    `SELECT s.*, p.id AS progress_id, p.event_id, p.result_pos, p.advanced, p.recorded_at
     FROM ladder_stages s
     LEFT JOIN rider_ladder_progress p
       ON p.stage_id = s.id AND p.rider_id = ?
     WHERE s.ladder_id = ?
     ORDER BY s.stage_order ASC`,
  )
    .bind(riderId, lad.id)
    .all();

  return c.json({ rider, ladder: lad, stages: stages.results });
});

// Record (or update) a result at a stage.
ladder.post("/progress", async (c) => {
  const b = await c.req.json().catch(() => ({}));
  const { rider_id, stage_id } = b ?? {};
  if (!rider_id || !stage_id)
    return c.json({ error: "rider_id and stage_id required" }, 400);

  const owns = await c.env.DB.prepare(
    "SELECT 1 FROM riders WHERE id = ? AND user_id = ?",
  )
    .bind(rider_id, c.var.user!.id)
    .first();
  if (!owns) return c.json({ error: "Rider not found" }, 404);

  const result_pos = b.result_pos != null ? Number(b.result_pos) : null;
  // Top-6 advances in most AMA area/regional formats — sensible default.
  const advanced = b.advanced != null ? (b.advanced ? 1 : 0) : result_pos != null && result_pos <= 6 ? 1 : 0;

  await c.env.DB.prepare(
    `INSERT INTO rider_ladder_progress (id, rider_id, stage_id, event_id, result_pos, advanced, recorded_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(rider_id, stage_id) DO UPDATE SET
       event_id = excluded.event_id,
       result_pos = excluded.result_pos,
       advanced = excluded.advanced,
       recorded_at = excluded.recorded_at`,
  )
    .bind(uid("rlp_"), rider_id, stage_id, b.event_id ?? null, result_pos, advanced, now())
    .run();

  return c.json({ ok: true });
});

ladder.delete("/progress/:id", async (c) => {
  // Ensure the progress row belongs to one of the user's riders.
  await c.env.DB.prepare(
    `DELETE FROM rider_ladder_progress WHERE id = ?
       AND rider_id IN (SELECT id FROM riders WHERE user_id = ?)`,
  )
    .bind(c.req.param("id"), c.var.user!.id)
    .run();
  return c.json({ ok: true });
});

export default ladder;
