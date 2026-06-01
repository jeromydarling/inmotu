import { Hono } from "hono";
import type { Env, Vars } from "../types";
import { uid } from "../lib/util";
import { rateLimit } from "../lib/budget";

// First-party analytics. Public POST /track increments a (day, event, label)
// counter — privacy-light, no PII, no third party. Admin GET /funnel rolls it
// up so we can see where users actually drop off.
const analytics = new Hono<{ Bindings: Env; Variables: Vars }>();

const ALLOWED = new Set([
  "pageview", "signup", "sector_pick", "near_me", "zip_search", "save_event",
  "start_sector", "discovery_run", "register_view", "publish_racer",
]);

const dayStamp = () => new Date().toISOString().slice(0, 10);

// POST /api/analytics/track  { event, label? }  — fire-and-forget.
analytics.post("/track", async (c) => {
  const b = await c.req.json().catch(() => ({}));
  const event = typeof b.event === "string" ? b.event : "";
  if (!ALLOWED.has(event)) return c.json({ ok: false });
  const label = typeof b.label === "string" ? b.label.slice(0, 80) : null;

  // Light per-IP cap so it can't be spammed into noise.
  const ip = c.req.header("cf-connecting-ip") ?? "anon";
  if (!(await rateLimit(c.env, `track:${ip}`, 120, 60))) return c.json({ ok: true });

  await c.env.DB.prepare(
    `INSERT INTO analytics (id, day, event, label, count) VALUES (?, ?, ?, ?, 1)
     ON CONFLICT(day, event, label) DO UPDATE SET count = count + 1`,
  )
    .bind(uid("an_"), dayStamp(), event, label)
    .run();
  return c.json({ ok: true });
});

export default analytics;
