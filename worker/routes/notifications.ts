import { Hono } from "hono";
import type { Env, Vars } from "../types";
import { requireAuth } from "../auth/middleware";
import { now, uid } from "../lib/util";

const notifications = new Hono<{ Bindings: Env; Variables: Vars }>();
notifications.use("*", requireAuth);

// List recent notifications + unread count.
notifications.get("/", async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT id, kind, title, body, href, read, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50",
  )
    .bind(c.var.user!.id)
    .all();
  const unread = await c.env.DB.prepare(
    "SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read = 0",
  )
    .bind(c.var.user!.id)
    .first<{ n: number }>();
  return c.json({ notifications: results, unread: unread?.n ?? 0 });
});

notifications.post("/read", async (c) => {
  const b = await c.req.json().catch(() => ({}));
  if (b.id) {
    await c.env.DB.prepare("UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?")
      .bind(b.id, c.var.user!.id)
      .run();
  } else {
    await c.env.DB.prepare("UPDATE notifications SET read = 1 WHERE user_id = ? AND read = 0")
      .bind(c.var.user!.id)
      .run();
  }
  return c.json({ ok: true });
});

// Delivery preferences.
notifications.get("/prefs", async (c) => {
  const row = await c.env.DB.prepare(
    "SELECT notify_email, notify_push, notify_deadlines FROM users WHERE id = ?",
  )
    .bind(c.var.user!.id)
    .first();
  return c.json({ prefs: row, vapidConfigured: !!c.env.VAPID_PUBLIC_KEY });
});

notifications.post("/prefs", async (c) => {
  const b = await c.req.json().catch(() => ({}));
  await c.env.DB.prepare(
    "UPDATE users SET notify_email = ?, notify_push = ?, notify_deadlines = ?, updated_at = ? WHERE id = ?",
  )
    .bind(
      b.notify_email ? 1 : 0,
      b.notify_push ? 1 : 0,
      b.notify_deadlines ? 1 : 0,
      now(),
      c.var.user!.id,
    )
    .run();
  return c.json({ ok: true });
});

// Web Push subscription management. The public VAPID key lets the client
// subscribe; the subscription is stored for the cron to push to.
notifications.get("/vapid", (c) => c.json({ key: c.env.VAPID_PUBLIC_KEY ?? null }));

notifications.post("/subscribe", async (c) => {
  const b = await c.req.json().catch(() => ({}));
  const sub = b.subscription;
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth)
    return c.json({ error: "validation", message: "Invalid subscription" }, 400);
  // Upsert by endpoint.
  await c.env.DB.prepare(
    `INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, created_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth`,
  )
    .bind(uid("psb_"), c.var.user!.id, sub.endpoint, sub.keys.p256dh, sub.keys.auth, now())
    .run();
  return c.json({ ok: true });
});

notifications.post("/unsubscribe", async (c) => {
  const b = await c.req.json().catch(() => ({}));
  if (b.endpoint) {
    await c.env.DB.prepare("DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?")
      .bind(b.endpoint, c.var.user!.id)
      .run();
  }
  return c.json({ ok: true });
});

export default notifications;
