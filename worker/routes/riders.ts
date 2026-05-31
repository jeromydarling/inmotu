import { Hono } from "hono";
import type { Env, Vars } from "../types";
import { requireAuth } from "../auth/middleware";
import { now, uid } from "../lib/util";
import { err } from "../lib/http";
import { FREE_RIDER_LIMIT, planMeets, requirePlan } from "../lib/entitlements";

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
    return err(c, "validation", "Rider name required");

  // Free plan is limited to a single rider profile; Family+ is unlimited.
  if (!planMeets(c.var.user!.plan, "family")) {
    const count = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM riders WHERE user_id = ?")
      .bind(c.var.user!.id)
      .first<{ n: number }>();
    if ((count?.n ?? 0) >= FREE_RIDER_LIMIT) {
      return c.json(
        {
          error: "upgrade_required",
          message: "The free plan includes 1 rider. Upgrade to Family for unlimited riders.",
          plan: "family",
        },
        402,
      );
    }
  }

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

// A rider's live/timed results across events — matched from MYLAPS/Speedhive
// (or manually-entered) classifications via rider_id.
riders.get("/:id/results", async (c) => {
  const id = c.req.param("id");
  const owns = await c.env.DB.prepare("SELECT 1 FROM riders WHERE id = ? AND user_id = ?")
    .bind(id, c.var.user!.id)
    .first();
  if (!owns) return err(c, "not_found", "Rider not found");
  const { results } = await c.env.DB.prepare(
    `SELECT lr.position, lr.start_number, lr.laps, lr.total_time, lr.best_lap, lr.gap, lr.status,
            s.name AS session_name, s.race_class, s.session_type, s.started_at,
            e.slug AS event_slug, e.title AS event_title, e.starts_at AS event_at
     FROM live_results lr
     JOIN race_sessions s ON s.id = lr.session_id
     JOIN events e ON e.id = s.event_id
     WHERE lr.rider_id = ?
     ORDER BY COALESCE(s.started_at, e.starts_at) DESC LIMIT 100`,
  )
    .bind(id)
    .all();
  return c.json({ results });
});

// Update a rider's progression fields — wins (for the BMX "wins to next class"
// counter) and skill_level (proficiency). Only the owner can edit.
riders.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const owns = await c.env.DB.prepare("SELECT 1 FROM riders WHERE id = ? AND user_id = ?")
    .bind(id, c.var.user!.id)
    .first();
  if (!owns) return err(c, "not_found", "Rider not found");
  const b = await c.req.json().catch(() => ({}));
  const sets: string[] = [];
  const binds: unknown[] = [];
  if (b.wins != null && Number.isFinite(Number(b.wins))) {
    sets.push("wins = ?");
    binds.push(Math.max(0, Math.round(Number(b.wins))));
  }
  if (typeof b.skill_level === "string" && ["novice", "intermediate", "expert", "pro"].includes(b.skill_level)) {
    sets.push("skill_level = ?");
    binds.push(b.skill_level);
  }
  if (sets.length === 0) return err(c, "validation", "nothing to update");
  await c.env.DB.prepare(`UPDATE riders SET ${sets.join(", ")} WHERE id = ?`)
    .bind(...binds, id)
    .run();
  const row = await c.env.DB.prepare("SELECT * FROM riders WHERE id = ?").bind(id).first();
  return c.json({ rider: row });
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

riders.post("/budget", requirePlan("budget"), async (c) => {
  const b = await c.req.json().catch(() => ({}));
  if (typeof b.amount_cents !== "number" || typeof b.category !== "string")
    return err(c, "validation", "category and amount_cents required");
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
