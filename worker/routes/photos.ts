import { Hono } from "hono";
import type { Env, Vars } from "../types";
import { requireAuth } from "../auth/middleware";
import { requirePlan } from "../lib/entitlements";
import { now, uid } from "../lib/util";

// Family photo timeline — stored in R2, metadata in D1.
const photos = new Hono<{ Bindings: Env; Variables: Vars }>();

// Raw image streaming (auth: must own the photo). Used as <img src>.
photos.get("/:id/raw", requireAuth, async (c) => {
  const row = await c.env.DB.prepare(
    "SELECT r2_key, content_type FROM photos WHERE id = ? AND user_id = ?",
  )
    .bind(c.req.param("id"), c.var.user!.id)
    .first<{ r2_key: string; content_type: string | null }>();
  if (!row) return c.json({ error: "Not found" }, 404);

  const obj = await c.env.MEDIA.get(row.r2_key);
  if (!obj) return c.json({ error: "Missing" }, 404);
  return new Response(obj.body, {
    headers: {
      "Content-Type": row.content_type || "image/jpeg",
      "Cache-Control": "private, max-age=86400",
    },
  });
});

photos.use("*", requireAuth);
photos.use("*", requirePlan("photos"));

// List the family's photos (optionally filtered by rider/event).
photos.get("/", async (c) => {
  const { rider_id, event_id } = c.req.query();
  const where = ["user_id = ?"];
  const binds: unknown[] = [c.var.user!.id];
  if (rider_id) (where.push("rider_id = ?"), binds.push(rider_id));
  if (event_id) (where.push("event_id = ?"), binds.push(event_id));
  const { results } = await c.env.DB.prepare(
    `SELECT id, rider_id, event_id, caption, taken_at, created_at
     FROM photos WHERE ${where.join(" AND ")} ORDER BY created_at DESC LIMIT 500`,
  )
    .bind(...binds)
    .all();
  return c.json({ photos: results });
});

// Upload (multipart form-data: file, optional rider_id/event_id/caption).
photos.post("/", async (c) => {
  const form = await c.req.parseBody();
  const file = form["file"];
  if (!(file instanceof File))
    return c.json({ error: "file required (multipart form-data)" }, 400);
  if (file.size > 15 * 1024 * 1024)
    return c.json({ error: "Max 15MB per photo" }, 413);
  if (!/^image\//.test(file.type))
    return c.json({ error: "Images only" }, 415);

  const id = uid("pho_");
  const ext = file.type.split("/")[1]?.replace("jpeg", "jpg") || "jpg";
  const key = `photos/${c.var.user!.id}/${id}.${ext}`;
  await c.env.MEDIA.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type },
  });

  const riderId = typeof form["rider_id"] === "string" && form["rider_id"] ? form["rider_id"] : null;
  const eventId = typeof form["event_id"] === "string" && form["event_id"] ? form["event_id"] : null;
  const caption = typeof form["caption"] === "string" ? form["caption"] : null;

  await c.env.DB.prepare(
    `INSERT INTO photos (id, user_id, rider_id, event_id, r2_key, content_type, caption, taken_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, c.var.user!.id, riderId, eventId, key, file.type, caption, now(), now())
    .run();

  return c.json({ photo: { id, rider_id: riderId, event_id: eventId, caption } }, 201);
});

photos.delete("/:id", async (c) => {
  const row = await c.env.DB.prepare(
    "SELECT r2_key FROM photos WHERE id = ? AND user_id = ?",
  )
    .bind(c.req.param("id"), c.var.user!.id)
    .first<{ r2_key: string }>();
  if (row) {
    c.executionCtx.waitUntil(c.env.MEDIA.delete(row.r2_key));
    await c.env.DB.prepare("DELETE FROM photos WHERE id = ? AND user_id = ?")
      .bind(c.req.param("id"), c.var.user!.id)
      .run();
  }
  return c.json({ ok: true });
});

export default photos;
