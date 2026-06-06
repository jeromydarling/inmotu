import { Hono } from "hono";
import type { Env, Vars } from "../types";
import { requireAuth } from "../auth/middleware";
import { requirePlan } from "../lib/entitlements";
import { err } from "../lib/http";
import { now, uid } from "../lib/util";
import { generateAsset, type AssetKind } from "../lib/ai";

// AI Marketing Studio — generate social posts, event promos, sponsor
// thank-yous, press blurbs, and recaps from the user's own data. Pro+.
const studio = new Hono<{ Bindings: Env; Variables: Vars }>();
studio.use("*", requireAuth);
studio.use("*", requirePlan("sponsors")); // Pro tier (same rank as sponsors)

const KINDS: AssetKind[] = ["social", "event_promo", "sponsor_thanks", "press", "recap"];

studio.post("/generate", async (c) => {
  const b = await c.req.json().catch(() => ({}));
  if (!KINDS.includes(b.kind)) return err(c, "validation", "Unknown asset kind");
  if (typeof b.subject !== "string" || !b.subject.trim())
    return err(c, "validation", "subject required");

  try {
    const body = await generateAsset(c.env, {
      kind: b.kind,
      subject: b.subject.trim(),
      details: typeof b.details === "string" ? b.details : undefined,
      tone: typeof b.tone === "string" ? b.tone : undefined,
      withHashtags: !!b.withHashtags,
      lang: b.lang === "es" ? "es" : undefined,
    });
    if (!body) return err(c, "internal", "The studio came up empty — try again.");
    return c.json({ body });
  } catch (e) {
    console.error("studio generate error", e);
    return err(c, "internal", "AI generation failed. Try again.");
  }
});

// Save a generated asset to the library.
studio.post("/assets", async (c) => {
  const b = await c.req.json().catch(() => ({}));
  if (typeof b.body !== "string" || !b.body.trim()) return err(c, "validation", "body required");
  const id = uid("mkt_");
  await c.env.DB.prepare(
    `INSERT INTO marketing_assets (id, user_id, kind, title, body, context, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      c.var.user!.id,
      b.kind ?? "social",
      b.title ?? null,
      b.body.trim(),
      b.context ? JSON.stringify(b.context) : null,
      now(),
    )
    .run();
  return c.json({ ok: true, id }, 201);
});

studio.get("/assets", async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT id, kind, title, body, context, created_at FROM marketing_assets WHERE user_id = ? ORDER BY created_at DESC LIMIT 100",
  )
    .bind(c.var.user!.id)
    .all();
  return c.json({ assets: results });
});

studio.delete("/assets/:id", async (c) => {
  await c.env.DB.prepare("DELETE FROM marketing_assets WHERE id = ? AND user_id = ?")
    .bind(c.req.param("id"), c.var.user!.id)
    .run();
  return c.json({ ok: true });
});

export default studio;
