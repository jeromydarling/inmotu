import { Hono } from "hono";
import type { Env, Vars } from "../types";
import { toPublicUser } from "../db";
import { hashPassword, isEmail, now, uid } from "../lib/util";
import { createSession, sessionCookie } from "../auth/session";

// Form-gated demo: capture a lead, provision a fully-seeded sandbox account,
// and drop the visitor straight into a populated dashboard.
const demo = new Hono<{ Bindings: Env; Variables: Vars }>();

demo.post("/", async (c) => {
  const b = await c.req.json().catch(() => ({}));
  if (!isEmail(b.email)) return c.json({ error: "Valid email required" }, 400);

  const ts = now();
  const userId = uid("usr_");
  const demoEmail = `demo+${userId}@inmotu.pro`;
  const hash = await hashPassword(uid("pw_")); // random, unusable

  await c.env.DB.prepare(
    `INSERT INTO users (id, email, password_hash, full_name, home_region, zip, plan, role, is_demo, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'North Central', '55044', 'pro', 'member', 1, ?, ?)`,
  )
    .bind(userId, demoEmail, hash, b.name?.trim() || "Demo Racer", ts, ts)
    .run();

  // Record the lead (real marketing capture).
  await c.env.DB.prepare(
    "INSERT INTO leads (id, name, email, role, user_id, created_at) VALUES (?, ?, ?, ?, ?, ?)",
  )
    .bind(uid("led_"), b.name ?? null, b.email, b.role ?? null, userId, ts)
    .run();

  await seedDemo(c.env, userId, ts);

  const sid = await createSession(c.env, userId);
  c.header("Set-Cookie", sessionCookie(sid, c.env.APP_ENV === "production"));
  const row = await c.env.DB.prepare(
    "SELECT id, email, full_name, home_region, zip, plan, role FROM users WHERE id = ?",
  )
    .bind(userId)
    .first<Record<string, unknown>>();
  return c.json({ user: toPublicUser(row!) }, 201);
});

async function seedDemo(env: Env, userId: string, ts: number) {
  const r1 = uid("rdr_");
  const r2 = uid("rdr_");
  const db = env.DB;
  const stmts: D1PreparedStatement[] = [
    db.prepare(
      `INSERT INTO riders (id, user_id, name, birthdate, discipline, race_class, number, skill_level, created_at)
       VALUES (?, ?, 'Cole', '2014-03-02', 'motocross', '85cc (10-12)', '42', 'intermediate', ?)`,
    ).bind(r1, userId, ts),
    db.prepare(
      `INSERT INTO riders (id, user_id, name, birthdate, discipline, race_class, number, skill_level, created_at)
       VALUES (?, ?, 'Mara', '2011-07-19', 'motocross', 'Supermini (12-16)', '17', 'novice', ?)`,
    ).bind(r2, userId, ts),
    // budget
    ...[
      ["entry", 4500, "Area qualifier"],
      ["travel", 38000, "Loretta's trip lodging + fuel"],
      ["maintenance", 26000, "Top end rebuild"],
      ["gear", 14000, "New boots + goggles"],
    ].map(([cat, amt, note]) =>
      db.prepare(
        `INSERT INTO budget_entries (id, user_id, rider_id, category, amount_cents, spent_at, note)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).bind(uid("bud_"), userId, r1, cat, amt, ts, note),
    ),
    // maintenance
    db.prepare(
      `INSERT INTO maintenance_logs (id, rider_id, performed_at, hours, item, notes, cost_cents)
       VALUES (?, ?, ?, 22.5, 'Top end rebuild', 'Piston, rings, gasket kit', 26000)`,
    ).bind(uid("mnt_"), r1, ts),
    db.prepare(
      `INSERT INTO maintenance_logs (id, rider_id, performed_at, hours, item, notes, cost_cents)
       VALUES (?, ?, ?, 8, 'Oil + filter', 'Routine service', 3500)`,
    ).bind(uid("mnt_"), r1, ts),
    // sponsor
    db.prepare(
      `INSERT INTO sponsors (id, user_id, name, tier, amount_cents, deliverables, renewal_at, status, created_at)
       VALUES (?, ?, 'Midwest Powersports', 'title', 250000, ?, ?, 'active', ?)`,
    ).bind(uid("spn_"), userId, JSON.stringify([{ text: "Trailer decal", done: true }, { text: "5 social posts", done: false }]), ts + 60 * 86400, ts),
  ];
  await db.batch(stmts);

  // Ladder progress for Cole on the MX ladder (first two stages cleared).
  const stages = await db
    .prepare(
      "SELECT id, stage_order FROM ladder_stages WHERE ladder_id = 'lad_rtll_2026' ORDER BY stage_order",
    )
    .all<{ id: string; stage_order: number }>();
  const prog = stages.results.slice(0, 2).map((s, i) =>
    db.prepare(
      `INSERT OR IGNORE INTO rider_ladder_progress (id, rider_id, stage_id, result_pos, advanced, recorded_at)
       VALUES (?, ?, ?, ?, 1, ?)`,
    ).bind(uid("rlp_"), r1, s.id, i === 0 ? 2 : 4, ts),
  );

  // Save a couple of upcoming events to the demo calendar.
  const evs = await db.prepare("SELECT id FROM events ORDER BY starts_at LIMIT 3").all<{ id: string }>();
  const saves = evs.results.map((e) =>
    db.prepare(
      "INSERT OR IGNORE INTO saved_events (user_id, event_id, reminder, created_at) VALUES (?, ?, 1, ?)",
    ).bind(userId, e.id, ts),
  );

  if (prog.length || saves.length) await db.batch([...prog, ...saves]);
}

export default demo;
