import { Hono } from "hono";
import type { Env, Vars } from "../types";
import { requireAuth } from "../auth/middleware";
import { requirePlan } from "../lib/entitlements";
import { now, uid } from "../lib/util";

// Sponsorship management — portfolio, deliverables, renewal tracking.
const sponsors = new Hono<{ Bindings: Env; Variables: Vars }>();
sponsors.use("*", requireAuth);
sponsors.use("*", requirePlan("sponsors"));

sponsors.get("/", async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM sponsors WHERE user_id = ? ORDER BY amount_cents DESC NULLS LAST, created_at DESC",
  )
    .bind(c.var.user!.id)
    .all();
  return c.json({ sponsors: results });
});

sponsors.post("/", async (c) => {
  const b = await c.req.json().catch(() => ({}));
  if (!b.name) return c.json({ error: "name required" }, 400);
  const id = uid("spn_");
  await c.env.DB.prepare(
    `INSERT INTO sponsors (id, user_id, name, tier, amount_cents, deliverables, renewal_at, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      c.var.user!.id,
      b.name,
      b.tier ?? "associate",
      b.amount_cents ?? null,
      b.deliverables ? JSON.stringify(b.deliverables) : null,
      b.renewal_at ?? null,
      b.status ?? "active",
      now(),
    )
    .run();
  return c.json({ ok: true, id }, 201);
});

sponsors.patch("/:id", async (c) => {
  const b = await c.req.json().catch(() => ({}));
  const fields: string[] = [];
  const binds: unknown[] = [];
  for (const k of ["name", "tier", "amount_cents", "status", "renewal_at"]) {
    if (k in b) (fields.push(`${k} = ?`), binds.push(b[k]));
  }
  if ("deliverables" in b) (fields.push("deliverables = ?"), binds.push(JSON.stringify(b.deliverables)));
  if (fields.length === 0) return c.json({ ok: true });
  binds.push(c.req.param("id"), c.var.user!.id);
  await c.env.DB.prepare(`UPDATE sponsors SET ${fields.join(", ")} WHERE id = ? AND user_id = ?`)
    .bind(...binds)
    .run();
  return c.json({ ok: true });
});

sponsors.delete("/:id", async (c) => {
  await c.env.DB.prepare("DELETE FROM sponsors WHERE id = ? AND user_id = ?")
    .bind(c.req.param("id"), c.var.user!.id)
    .run();
  return c.json({ ok: true });
});

export default sponsors;
