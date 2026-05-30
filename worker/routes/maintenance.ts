import { Hono } from "hono";
import type { Env, Vars } from "../types";
import { requireAuth } from "../auth/middleware";
import { now, uid } from "../lib/util";
import { ownsRider } from "../db";
import { err } from "../lib/http";

// Maintenance log — service tracker per rider/bike (affordability + reliability).
const maintenance = new Hono<{ Bindings: Env; Variables: Vars }>();
maintenance.use("*", requireAuth);

maintenance.get("/", async (c) => {
  const { rider_id } = c.req.query();
  const where = ["r.user_id = ?"];
  const binds: unknown[] = [c.var.user!.id];
  if (rider_id) (where.push("m.rider_id = ?"), binds.push(rider_id));
  const { results } = await c.env.DB.prepare(
    `SELECT m.*, r.name AS rider_name FROM maintenance_logs m
     JOIN riders r ON r.id = m.rider_id
     WHERE ${where.join(" AND ")} ORDER BY m.performed_at DESC LIMIT 200`,
  )
    .bind(...binds)
    .all();
  return c.json({ logs: results });
});

maintenance.post("/", async (c) => {
  const b = await c.req.json().catch(() => ({}));
  if (!b.rider_id || typeof b.item !== "string" || !b.item.trim())
    return err(c, "validation", "rider_id and item required");
  if (!(await ownsRider(c.env, b.rider_id, c.var.user!.id))) return err(c, "not_found", "Rider not found");

  const id = uid("mnt_");
  await c.env.DB.prepare(
    `INSERT INTO maintenance_logs (id, rider_id, performed_at, hours, item, notes, cost_cents)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, b.rider_id, b.performed_at ?? now(), b.hours ?? null, b.item.trim(), b.notes ?? null, b.cost_cents ?? null)
    .run();

  // Optionally mirror the cost into the season budget under "maintenance".
  if (typeof b.cost_cents === "number" && b.cost_cents > 0 && b.add_to_budget) {
    await c.env.DB.prepare(
      `INSERT INTO budget_entries (id, user_id, rider_id, category, amount_cents, spent_at, note)
       VALUES (?, ?, ?, 'maintenance', ?, ?, ?)`,
    )
      .bind(uid("bud_"), c.var.user!.id, b.rider_id, b.cost_cents, b.performed_at ?? now(), b.item.trim())
      .run();
  }
  return c.json({ ok: true, id }, 201);
});

maintenance.delete("/:id", async (c) => {
  await c.env.DB.prepare(
    `DELETE FROM maintenance_logs WHERE id = ?
       AND rider_id IN (SELECT id FROM riders WHERE user_id = ?)`,
  )
    .bind(c.req.param("id"), c.var.user!.id)
    .run();
  return c.json({ ok: true });
});

export default maintenance;
