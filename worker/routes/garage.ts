import { Hono } from "hono";
import type { Env, Vars } from "../types";
import { requireAuth } from "../auth/middleware";
import { requirePlan } from "../lib/entitlements";
import { now, uid } from "../lib/util";

// The Garage — team ops: vehicle setup database + endurance stint planner.
const garage = new Hono<{ Bindings: Env; Variables: Vars }>();
garage.use("*", requireAuth);
garage.use("*", requirePlan("garage"));

// ── Setup database ────────────────────────────────────────────────────
garage.get("/setups", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT s.*, t.name AS track_name FROM vehicle_setups s
     LEFT JOIN tracks t ON t.id = s.track_id
     WHERE s.user_id = ? ORDER BY s.created_at DESC`,
  )
    .bind(c.var.user!.id)
    .all();
  return c.json({ setups: results });
});

garage.post("/setups", async (c) => {
  const b = await c.req.json().catch(() => ({}));
  if (typeof b.label !== "string" || !b.label.trim())
    return c.json({ error: "Setup label required" }, 400);
  const id = uid("set_");
  await c.env.DB.prepare(
    `INSERT INTO vehicle_setups (id, user_id, rider_id, label, track_id, conditions, data, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      c.var.user!.id,
      b.rider_id ?? null,
      b.label.trim(),
      b.track_id ?? null,
      b.conditions ?? null,
      b.data ? JSON.stringify(b.data) : null,
      now(),
    )
    .run();
  return c.json({ ok: true, id }, 201);
});

garage.delete("/setups/:id", async (c) => {
  await c.env.DB.prepare("DELETE FROM vehicle_setups WHERE id = ? AND user_id = ?")
    .bind(c.req.param("id"), c.var.user!.id)
    .run();
  return c.json({ ok: true });
});

// ── Stint planner ─────────────────────────────────────────────────────
garage.get("/stints", async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM stint_plans WHERE user_id = ? ORDER BY created_at DESC",
  )
    .bind(c.var.user!.id)
    .all();
  return c.json({ plans: results });
});

garage.post("/stints", async (c) => {
  const b = await c.req.json().catch(() => ({}));
  const race = Number(b.race_minutes);
  const stint = Number(b.stint_minutes);
  const fuel = Number(b.fuel_minutes);
  if (!b.name || !race || !stint || !fuel)
    return c.json({ error: "name, race_minutes, stint_minutes, fuel_minutes required" }, 400);

  const id = uid("stp_");
  await c.env.DB.prepare(
    `INSERT INTO stint_plans (id, user_id, event_id, name, race_minutes, stint_minutes, fuel_minutes, drivers, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      c.var.user!.id,
      b.event_id ?? null,
      String(b.name).trim(),
      race,
      stint,
      fuel,
      b.drivers ? JSON.stringify(b.drivers) : null,
      now(),
    )
    .run();
  return c.json({ ok: true, id }, 201);
});

garage.delete("/stints/:id", async (c) => {
  await c.env.DB.prepare("DELETE FROM stint_plans WHERE id = ? AND user_id = ?")
    .bind(c.req.param("id"), c.var.user!.id)
    .run();
  return c.json({ ok: true });
});

export default garage;
