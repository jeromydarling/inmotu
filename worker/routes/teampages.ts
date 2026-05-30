import { Hono } from "hono";
import type { Env, Vars } from "../types";
import { requireAuth } from "../auth/middleware";
import { requirePlan } from "../lib/entitlements";
import { err } from "../lib/http";
import { now, uid, slugify } from "../lib/util";
import { generateBio } from "../lib/ai";

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

  // Pull the owner's riders + recent results as public content.
  const riders = await c.env.DB.prepare(
    "SELECT name, race_class, number, discipline FROM riders WHERE user_id = ? ORDER BY created_at LIMIT 12",
  )
    .bind(page.user_id)
    .all();
  return c.json({ page, riders: riders.results });
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

  if (existing) {
    await c.env.DB.prepare(
      `UPDATE team_pages SET name=?, tagline=?, bio=?, hometown=?, discipline=?, hero_slug=?, published=?, updated_at=?
       WHERE id=?`,
    )
      .bind(
        b.name.trim(),
        b.tagline ?? null,
        b.bio ?? null,
        b.hometown ?? null,
        b.discipline ?? null,
        b.hero_slug ?? null,
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
    `INSERT INTO team_pages (id, user_id, slug, name, tagline, bio, hometown, discipline, hero_slug, published, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
