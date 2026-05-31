import { Hono } from "hono";
import type { Env, Vars } from "../types";
import { requireAuth } from "../auth/middleware";
import { err } from "../lib/http";
import { now, uid, slugify } from "../lib/util";
import { extractImport } from "../lib/ai";

// Onboarding + AI-assisted import.
const onboarding = new Hono<{ Bindings: Env; Variables: Vars }>();
onboarding.use("*", requireAuth);

// First-login state: what the user still needs to do (drives the wizard +
// the progress checklist). Computed live from their data.
onboarding.get("/status", async (c) => {
  const u = c.var.user!.id;
  const [riders, saved, page, photos] = await Promise.all([
    c.env.DB.prepare("SELECT COUNT(*) AS n FROM riders WHERE user_id = ?").bind(u).first<{ n: number }>(),
    c.env.DB.prepare("SELECT COUNT(*) AS n FROM saved_events WHERE user_id = ?").bind(u).first<{ n: number }>(),
    c.env.DB.prepare("SELECT 1 FROM team_pages WHERE user_id = ?").bind(u).first(),
    c.env.DB.prepare("SELECT COUNT(*) AS n FROM photos WHERE user_id = ?").bind(u).first<{ n: number }>(),
  ]);
  const steps = {
    addRider: (riders?.n ?? 0) > 0,
    saveEvent: (saved?.n ?? 0) > 0,
    addPhoto: (photos?.n ?? 0) > 0,
    microsite: !!page,
  };
  const done = Object.values(steps).filter(Boolean).length;
  return c.json({ steps, done, total: Object.keys(steps).length, role: c.var.user!.role, plan: c.var.user!.plan });
});

// AI import — parse pasted text into structured riders + events (preview only).
onboarding.post("/import/parse", async (c) => {
  const b = await c.req.json().catch(() => ({}));
  if (typeof b.text !== "string" || b.text.trim().length < 10)
    return err(c, "validation", "Paste a bit more text to import.");
  try {
    const result = await extractImport(c.env, b.text);
    if (result.riders.length === 0 && result.events.length === 0)
      return c.json({ riders: [], events: [], note: "Couldn't find riders or events in that text." });
    return c.json(result);
  } catch (e) {
    console.error("import parse error", e);
    return err(c, "internal", "AI import failed. Try again or add items manually.");
  }
});

// Commit reviewed import: create riders, and save/create events to the calendar.
onboarding.post("/import/commit", async (c) => {
  const b = await c.req.json().catch(() => ({}));
  const riders: any[] = Array.isArray(b.riders) ? b.riders : [];
  const events: any[] = Array.isArray(b.events) ? b.events : [];
  const ts = now();
  let ridersAdded = 0;
  let eventsAdded = 0;

  for (const r of riders.slice(0, 50)) {
    if (!r?.name) continue;
    await c.env.DB.prepare(
      `INSERT INTO riders (id, user_id, name, discipline, race_class, number, skill_level, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'novice', ?)`,
    )
      .bind(uid("rdr_"), c.var.user!.id, String(r.name).slice(0, 80), r.discipline ?? null, r.race_class ?? null, r.number ?? null, ts)
      .run();
    ridersAdded++;
  }

  for (const e of events.slice(0, 50)) {
    if (!e?.title) continue;
    const startsAt = e.date ? Math.floor(new Date(e.date + "T12:00:00Z").getTime() / 1000) : ts + 7 * 86400;
    if (Number.isNaN(startsAt)) continue;
    const slug = slugify(`${e.title}-${e.state ?? ""}-${e.date ?? ""}`, { maxLen: 64, unique: true });
    const id = uid("evt_");
    // User-imported events are private to their calendar (source=import).
    await c.env.DB.prepare(
      `INSERT INTO events (id, slug, title, discipline, region, level, age_group, starts_at, source, created_at)
       VALUES (?, ?, ?, ?, ?, 'club', 'all', ?, 'import', ?)`,
    )
      .bind(id, slug, String(e.title).slice(0, 160), e.discipline ?? null, e.state ?? null, startsAt, ts)
      .run();
    await c.env.DB.prepare(
      "INSERT OR IGNORE INTO saved_events (user_id, event_id, reminder, created_at) VALUES (?, ?, 1, ?)",
    )
      .bind(c.var.user!.id, id, ts)
      .run();
    eventsAdded++;
  }

  return c.json({ ok: true, ridersAdded, eventsAdded });
});

export default onboarding;
