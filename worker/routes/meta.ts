import { Hono } from "hono";
import type { Env, Vars } from "../types";
import { FEATURE_MIN, FREE_RIDER_LIMIT, planMeets } from "../lib/entitlements";

// Reference data + lightweight platform stats for the landing page.
const meta = new Hono<{ Bindings: Env; Variables: Vars }>();

// Per-user capabilities so the SPA can gate UI gracefully (show upgrade
// prompts instead of letting the user hit a 402). Mirrors lib/entitlements.
meta.get("/capabilities", (c) => {
  const plan = c.var.user?.plan ?? "free";
  const role = c.var.user?.role ?? "member";
  const can = Object.fromEntries(
    Object.entries(FEATURE_MIN).map(([f, min]) => [f, planMeets(plan, min)]),
  );
  // Tower is operator-gated (plan OR role).
  can.tower = planMeets(plan, "tower") || role === "operator" || role === "admin";
  return c.json({
    plan,
    role,
    can,
    riderLimit: planMeets(plan, "family") ? null : FREE_RIDER_LIMIT,
  });
});

meta.get("/reference", async (c) => {
  const [disciplines, bodies, regions] = await Promise.all([
    c.env.DB.prepare("SELECT slug, label, kind FROM disciplines ORDER BY label").all(),
    c.env.DB.prepare("SELECT slug, label FROM sanctioning_bodies ORDER BY label").all(),
    c.env.DB.prepare(
      "SELECT DISTINCT region FROM events WHERE region IS NOT NULL ORDER BY region",
    ).all(),
  ]);
  return c.json({
    disciplines: disciplines.results,
    bodies: bodies.results,
    regions: regions.results.map((r) => (r as { region: string }).region),
  });
});

// Public runtime config for the SPA (e.g. the Mapbox publishable token).
meta.get("/config", (c) =>
  c.json({
    mapbox_token: c.env.MAPBOX_TOKEN ?? null,
    app_url: c.env.APP_URL,
  }),
);

// Approximate marketing counters for the (public, high-traffic) landing page.
// Cached in KV for 60s so the four COUNT scans don't run on every hit.
meta.get("/stats", async (c) => {
  const cached = await c.env.SESSIONS.get("stats:landing");
  if (cached) return c.json({ stats: JSON.parse(cached) });

  const row = await c.env.DB.prepare(
    `SELECT
       (SELECT COUNT(*) FROM events WHERE starts_at >= unixepoch() - 86400) AS upcoming_events,
       (SELECT COUNT(*) FROM tracks) AS tracks,
       (SELECT COUNT(*) FROM legislation WHERE status IN ('introduced','committee','passed')) AS active_bills,
       (SELECT COUNT(*) FROM legislation WHERE status = 'enacted') AS enacted_bills`,
  ).first();
  c.executionCtx.waitUntil(
    c.env.SESSIONS.put("stats:landing", JSON.stringify(row), { expirationTtl: 60 }),
  );
  return c.json({ stats: row });
});

export default meta;
