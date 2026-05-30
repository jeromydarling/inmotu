import { Hono } from "hono";
import type { Env, Vars } from "../types";
import { now, uid } from "../lib/util";

// The Frontline — Right to Race advocacy. Read is public; actions need auth.
const advocacy = new Hono<{ Bindings: Env; Variables: Vars }>();

advocacy.get("/legislation", async (c) => {
  const { status, state } = c.req.query();
  const where: string[] = [];
  const binds: unknown[] = [];
  if (status) (where.push("l.status = ?"), binds.push(status));
  if (state) (where.push("l.state = ?"), binds.push(state));

  const sql = `
    SELECT l.*,
      (SELECT COUNT(*) FROM advocacy_actions a
        WHERE a.target_type='legislation' AND a.target_id=l.id) AS supporters
    FROM legislation l
    ${where.length ? "WHERE " + where.join(" AND ") : ""}
    ORDER BY CASE l.status
      WHEN 'enacted' THEN 0 WHEN 'passed' THEN 1
      WHEN 'committee' THEN 2 WHEN 'introduced' THEN 3 ELSE 4 END,
      l.state_name ASC`;
  const { results } = await c.env.DB.prepare(sql)
    .bind(...binds)
    .all();

  let supported = new Set<string>();
  if (c.var.user) {
    const r = await c.env.DB.prepare(
      "SELECT target_id FROM advocacy_actions WHERE user_id = ? AND target_type='legislation'",
    )
      .bind(c.var.user.id)
      .all<{ target_id: string }>();
    supported = new Set(r.results.map((x) => x.target_id));
  }
  return c.json({
    legislation: results.map((l) => ({
      ...l,
      supported: supported.has(l.id as string),
    })),
  });
});

// Endangered tracks map data
advocacy.get("/endangered", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT t.id, t.slug, t.name, t.city, t.state, t.lat, t.lng, t.status,
            th.threat_type, th.description, th.verified
     FROM tracks t
     LEFT JOIN track_threats th ON th.track_id = t.id
     WHERE t.status = 'endangered'`,
  ).all();
  return c.json({ tracks: results });
});

// Pledge support / record an advocacy action
advocacy.post("/support", async (c) => {
  if (!c.var.user) return c.json({ error: "Authentication required" }, 401);
  const b = await c.req.json().catch(() => ({}));
  const { kind, target_type, target_id } = b ?? {};
  if (!kind || !target_type || !target_id)
    return c.json({ error: "kind, target_type, target_id required" }, 400);
  try {
    await c.env.DB.prepare(
      `INSERT INTO advocacy_actions (id, user_id, kind, target_type, target_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
      .bind(uid("act_"), c.var.user.id, kind, target_type, target_id, now())
      .run();
  } catch {
    // UNIQUE violation = already supported; treat as idempotent success
  }
  const count = await c.env.DB.prepare(
    "SELECT COUNT(*) AS n FROM advocacy_actions WHERE target_type=? AND target_id=?",
  )
    .bind(target_type, target_id)
    .first<{ n: number }>();
  return c.json({ ok: true, supporters: count?.n ?? 0 });
});

export default advocacy;
