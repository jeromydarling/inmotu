import { Hono } from "hono";
import type { Env, Vars } from "../types";
import { requireAuth } from "../auth/middleware";
import { now, uid } from "../lib/util";

// The Pit Board — family & rider management. All routes require auth.
const riders = new Hono<{ Bindings: Env; Variables: Vars }>();
riders.use("*", requireAuth);

riders.get("/", async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM riders WHERE user_id = ? ORDER BY created_at ASC",
  )
    .bind(c.var.user!.id)
    .all();
  return c.json({ riders: results });
});

riders.post("/", async (c) => {
  const b = await c.req.json().catch(() => ({}));
  if (typeof b.name !== "string" || !b.name.trim())
    return c.json({ error: "Rider name required" }, 400);
  const id = uid("rdr_");
  await c.env.DB.prepare(
    `INSERT INTO riders (id, user_id, name, birthdate, discipline, race_class, number, ama_license, skill_level, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      c.var.user!.id,
      b.name.trim(),
      b.birthdate ?? null,
      b.discipline ?? null,
      b.race_class ?? null,
      b.number ?? null,
      b.ama_license ?? null,
      b.skill_level ?? "novice",
      now(),
    )
    .run();
  const row = await c.env.DB.prepare("SELECT * FROM riders WHERE id = ?")
    .bind(id)
    .first();
  return c.json({ rider: row }, 201);
});

riders.delete("/:id", async (c) => {
  await c.env.DB.prepare("DELETE FROM riders WHERE id = ? AND user_id = ?")
    .bind(c.req.param("id"), c.var.user!.id)
    .run();
  return c.json({ ok: true });
});

// Budget summary across the family's season
riders.get("/budget/summary", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT category, SUM(amount_cents) AS total
     FROM budget_entries WHERE user_id = ? GROUP BY category`,
  )
    .bind(c.var.user!.id)
    .all();
  return c.json({ summary: results });
});

riders.post("/budget", async (c) => {
  const b = await c.req.json().catch(() => ({}));
  if (typeof b.amount_cents !== "number" || typeof b.category !== "string")
    return c.json({ error: "category and amount_cents required" }, 400);
  const id = uid("bud_");
  await c.env.DB.prepare(
    `INSERT INTO budget_entries (id, user_id, rider_id, category, amount_cents, spent_at, note)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      c.var.user!.id,
      b.rider_id ?? null,
      b.category,
      b.amount_cents,
      b.spent_at ?? now(),
      b.note ?? null,
    )
    .run();
  return c.json({ ok: true, id }, 201);
});

export default riders;
