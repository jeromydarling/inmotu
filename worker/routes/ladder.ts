import { Hono } from "hono";
import type { Env, Vars } from "../types";
import { requireAuth } from "../auth/middleware";
import { requirePlan } from "../lib/entitlements";
import { now, uid } from "../lib/util";
import { ownsRider } from "../db";
import { err } from "../lib/http";

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

// Viewing a rider's ladder is open to any signed-in user; recording progress
// (the active tracker) is a Family feature.
ladder.use("/rider/*", requireAuth);
ladder.use("/progress", requireAuth, requirePlan("ladder"));
ladder.use("/progress/*", requireAuth, requirePlan("ladder"));

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
    return err(c, "validation", "rider_id and stage_id required");

  if (!(await ownsRider(c.env, rider_id, c.var.user!.id))) return err(c, "not_found", "Rider not found");

  const result_pos = b.result_pos != null ? Number(b.result_pos) : null;
  // Advance threshold is per-stage (pos_advances); fall back to top-6. Explicit
  // `advanced` in the body always wins. This makes advancement data-driven so
  // each sport's real rule (BMX top-8/10, drag points) works without hardcoding.
  let advanced: number;
  if (b.advanced != null) {
    advanced = b.advanced ? 1 : 0;
  } else if (result_pos == null) {
    advanced = 0;
  } else {
    const stage = await c.env.DB.prepare("SELECT pos_advances FROM ladder_stages WHERE id = ?")
      .bind(stage_id)
      .first<{ pos_advances: number | null }>();
    const threshold = stage?.pos_advances ?? 6;
    advanced = result_pos <= threshold ? 1 : 0;
  }

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

// ── BMX NAG points (best-8 calculator) ───────────────────────────────────────
// All NAG routes require auth; logging requires the ladder (Family) entitlement.
ladder.use("/nag/*", requireAuth);

// A rider's NAG standing: their scores + best-8 total + "what you need next".
ladder.get("/nag/:riderId", async (c) => {
  const riderId = c.req.param("riderId");
  if (!(await ownsRider(c.env, riderId, c.var.user!.id))) return err(c, "not_found", "Rider not found");

  const { results } = await c.env.DB.prepare(
    "SELECT id, label, points, raced_at, created_at FROM bmx_scores WHERE rider_id = ? ORDER BY points DESC, created_at ASC",
  )
    .bind(riderId)
    .all<{ id: string; label: string | null; points: number; raced_at: number | null; created_at: number }>();

  const scores = results;
  // Best 8 scores count toward the NAG total (USA BMX rule).
  const COUNTING = 8;
  const sorted = [...scores].sort((a, b) => b.points - a.points);
  const countingIds = new Set(sorted.slice(0, COUNTING).map((s) => s.id));
  const total = sorted.slice(0, COUNTING).reduce((sum, s) => sum + s.points, 0);

  // The lowest-counting score is the one a new race must beat to improve.
  const counting = sorted.slice(0, COUNTING);
  const dropScore = counting.length === COUNTING ? counting[counting.length - 1].points : 0;
  const racesUntilFull = Math.max(0, COUNTING - scores.length);

  return c.json({
    scores: scores.map((s) => ({ ...s, counting: countingIds.has(s.id) })),
    total,
    counting_count: counting.length,
    needed: COUNTING,
    races_until_full:racesUntilFull,
    // Once you have 8, only a score above this replaces your weakest counting one.
    improve_threshold: scores.length >= COUNTING ? dropScore : null,
  });
});

// Log a score (a race result's points). Family feature.
ladder.post("/nag/:riderId", requirePlan("ladder"), async (c) => {
  const riderId = c.req.param("riderId");
  if (!(await ownsRider(c.env, riderId, c.var.user!.id))) return err(c, "not_found", "Rider not found");
  const b = await c.req.json().catch(() => ({}));
  const points = Number(b.points);
  if (!Number.isFinite(points) || points < 0) return err(c, "validation", "points required");
  const id = uid("nag_");
  await c.env.DB.prepare(
    "INSERT INTO bmx_scores (id, rider_id, label, points, raced_at, created_at) VALUES (?, ?, ?, ?, ?, ?)",
  )
    .bind(id, riderId, typeof b.label === "string" ? b.label.slice(0, 80) : null, Math.round(points), b.raced_at ?? null, now())
    .run();
  return c.json({ ok: true, id }, 201);
});

// Delete a logged score. Family feature.
ladder.delete("/nag/score/:id", requirePlan("ladder"), async (c) => {
  await c.env.DB.prepare(
    `DELETE FROM bmx_scores WHERE id = ?
       AND rider_id IN (SELECT id FROM riders WHERE user_id = ?)`,
  )
    .bind(c.req.param("id"), c.var.user!.id)
    .run();
  return c.json({ ok: true });
});

export default ladder;
