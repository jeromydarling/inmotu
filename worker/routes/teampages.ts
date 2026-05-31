import { Hono } from "hono";
import type { Env, Vars } from "../types";
import { requireAuth } from "../auth/middleware";
import { requirePlan } from "../lib/entitlements";
import { err } from "../lib/http";
import { now, uid, slugify, parseJson } from "../lib/util";
import { generateBio } from "../lib/ai";

// Default dynamic sections shown on a microsite when the owner hasn't chosen.
const DEFAULT_SECTIONS = {
  riders: true,
  events: true,
  ladder: false,
  photos: true,
  sponsors: false,
  stats: true,
  video: true,
};

// Team/family microsites — public SEO pages at /t/:slug. Managed by Pro+.
const teampages = new Hono<{ Bindings: Env; Variables: Vars }>();

// ── Public read (used by the SSR meta route + the public page) ────────
teampages.get("/public/:slug", async (c) => {
  const page = await c.env.DB.prepare(
    "SELECT * FROM team_pages WHERE slug = ? AND published = 1",
  )
    .bind(c.req.param("slug"))
    .first<Record<string, any>>();
  if (!page) return err(c, "not_found");

  const sections = { ...DEFAULT_SECTIONS, ...parseJson<Record<string, boolean>>(page.sections, {}) };
  const uid_ = page.user_id;
  const out: Record<string, unknown> = {};

  // Assemble only the sections the owner enabled (parallel reads).
  const tasks: Promise<void>[] = [];
  if (sections.riders) {
    tasks.push(
      c.env.DB.prepare(
        "SELECT name, race_class, number, discipline FROM riders WHERE user_id = ? ORDER BY created_at LIMIT 12",
      )
        .bind(uid_)
        .all()
        .then((r) => {
          out.riders = r.results;
        }),
    );
  }
  if (sections.events) {
    // Upcoming events the family has saved or registered for.
    tasks.push(
      c.env.DB.prepare(
        `SELECT DISTINCT e.slug, e.title, e.starts_at, e.discipline, t.name AS track_name, t.state
         FROM events e LEFT JOIN tracks t ON t.id = e.track_id
         WHERE e.starts_at >= unixepoch() - 86400 AND e.id IN (
           SELECT event_id FROM saved_events WHERE user_id = ?
           UNION SELECT event_id FROM registrations WHERE user_id = ?)
         ORDER BY e.starts_at ASC LIMIT 8`,
      )
        .bind(uid_, uid_)
        .all()
        .then((r) => {
          out.events = r.results;
        }),
    );
  }
  if (sections.photos) {
    tasks.push(
      c.env.DB.prepare(
        "SELECT id, caption FROM photos WHERE user_id = ? AND public = 1 ORDER BY created_at DESC LIMIT 12",
      )
        .bind(uid_)
        .all()
        .then((r) => {
          out.photos = r.results;
        }),
    );
  }
  if (sections.sponsors) {
    tasks.push(
      c.env.DB.prepare(
        "SELECT name, tier FROM sponsors WHERE user_id = ? AND status = 'active' ORDER BY amount_cents DESC NULLS LAST LIMIT 12",
      )
        .bind(uid_)
        .all()
        .then((r) => {
          out.sponsors = r.results;
        }),
    );
  }
  if (sections.ladder) {
    tasks.push(
      c.env.DB.prepare(
        `SELECT r.name AS rider, s.name AS stage, p.result_pos, p.advanced
         FROM rider_ladder_progress p
         JOIN riders r ON r.id = p.rider_id
         JOIN ladder_stages s ON s.id = p.stage_id
         WHERE r.user_id = ? ORDER BY s.stage_order LIMIT 12`,
      )
        .bind(uid_)
        .all()
        .then((r) => {
          out.ladder = r.results;
        }),
    );
  }
  if (sections.stats) {
    tasks.push(
      c.env.DB.prepare(
        `SELECT
           (SELECT COUNT(*) FROM riders WHERE user_id = ?) AS riders,
           (SELECT COUNT(*) FROM registrations WHERE user_id = ?) AS races,
           (SELECT COUNT(*) FROM rider_ladder_progress p JOIN riders r ON r.id = p.rider_id WHERE r.user_id = ? AND p.advanced = 1) AS advancements`,
      )
        .bind(uid_, uid_, uid_)
        .first()
        .then((r) => {
          out.stats = r;
        }),
    );
  }
  await Promise.all(tasks);

  return c.json({
    page: {
      ...page,
      socials: parseJson<Record<string, string>>(page.socials, {}),
      sections,
    },
    ...out,
  });
});

// ── Owner management (Pro+) ───────────────────────────────────────────
teampages.use("/mine", requireAuth, requirePlan("sponsors"));
teampages.use("/mine/*", requireAuth, requirePlan("sponsors"));

teampages.get("/mine", async (c) => {
  const page = await c.env.DB.prepare("SELECT * FROM team_pages WHERE user_id = ?")
    .bind(c.var.user!.id)
    .first();
  return c.json({ page: page ?? null });
});

teampages.post("/mine", async (c) => {
  const b = await c.req.json().catch(() => ({}));
  if (typeof b.name !== "string" || !b.name.trim()) return err(c, "validation", "name required");

  const existing = await c.env.DB.prepare("SELECT id, slug FROM team_pages WHERE user_id = ?")
    .bind(c.var.user!.id)
    .first<{ id: string; slug: string }>();
  const ts = now();

  // Normalize the optional rich fields.
  const accent = typeof b.accent_color === "string" && /^#[0-9a-fA-F]{6}$/.test(b.accent_color) ? b.accent_color : null;
  const socials = b.socials && typeof b.socials === "object" ? JSON.stringify(b.socials) : null;
  const sectionsJson = b.sections && typeof b.sections === "object" ? JSON.stringify(b.sections) : null;
  const video = typeof b.featured_video === "string" ? b.featured_video.trim() || null : null;

  if (existing) {
    await c.env.DB.prepare(
      `UPDATE team_pages SET name=?, tagline=?, bio=?, hometown=?, discipline=?, hero_slug=?,
         accent_color=?, socials=?, sections=?, featured_video=?, published=?, updated_at=?
       WHERE id=?`,
    )
      .bind(
        b.name.trim(),
        b.tagline ?? null,
        b.bio ?? null,
        b.hometown ?? null,
        b.discipline ?? null,
        b.hero_slug ?? null,
        accent,
        socials,
        sectionsJson,
        video,
        b.published ? 1 : 0,
        ts,
        existing.id,
      )
      .run();
    const row = await c.env.DB.prepare("SELECT * FROM team_pages WHERE id = ?").bind(existing.id).first();
    return c.json({ page: row });
  }

  // New page — generate a unique slug from the name.
  const id = uid("tpg_");
  let slug = slugify(b.name, { maxLen: 40 });
  const clash = await c.env.DB.prepare("SELECT 1 FROM team_pages WHERE slug = ?").bind(slug).first();
  if (clash) slug = slugify(b.name, { maxLen: 40, unique: true });
  await c.env.DB.prepare(
    `INSERT INTO team_pages (id, user_id, slug, name, tagline, bio, hometown, discipline, hero_slug,
       accent_color, socials, sections, featured_video, published, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      c.var.user!.id,
      slug,
      b.name.trim(),
      b.tagline ?? null,
      b.bio ?? null,
      b.hometown ?? null,
      b.discipline ?? null,
      b.hero_slug ?? "paddock",
      accent,
      socials,
      sectionsJson,
      video,
      b.published ? 1 : 0,
      ts,
      ts,
    )
    .run();
  const row = await c.env.DB.prepare("SELECT * FROM team_pages WHERE id = ?").bind(id).first();
  return c.json({ page: row }, 201);
});

// AI-generate a tagline + bio from sparse facts.
teampages.post("/mine/ai-bio", async (c) => {
  const b = await c.req.json().catch(() => ({}));
  if (typeof b.name !== "string" || !b.name.trim()) return err(c, "validation", "name required");
  try {
    const { tagline, bio } = await generateBio(c.env, b.name.trim(), b.facts ?? "");
    return c.json({ tagline, bio });
  } catch (e) {
    console.error("ai-bio error", e);
    return err(c, "internal", "Couldn't generate a bio. Try again.");
  }
});

export default teampages;
