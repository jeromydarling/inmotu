import { Hono } from "hono";
import type { Env, Vars } from "../types";
import { requireAuth } from "../auth/middleware";
import { now, uid } from "../lib/util";
import { ownsEvent } from "../db";
import { err } from "../lib/http";
import { notify } from "../lib/notify";

// Communication center — operators post updates to an event; families who are
// registered for (or have saved) that event see them in their Updates feed.
const comms = new Hono<{ Bindings: Env; Variables: Vars }>();
comms.use("*", requireAuth);

// Operator: post an announcement for an event they own.
comms.post("/events/:id/announce", async (c) => {
  const eventId = c.req.param("id");
  if (!(await ownsEvent(c.env, eventId, c.var.user!.id))) return err(c, "not_found");

  const b = await c.req.json().catch(() => ({}));
  if (!b.title || !b.body) return err(c, "validation", "title and body required");
  const id = uid("ann_");
  await c.env.DB.prepare(
    `INSERT INTO announcements (id, event_id, operator_id, title, body, urgent, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, eventId, c.var.user!.id, b.title, b.body, b.urgent ? 1 : 0, now())
    .run();

  // Recipients = everyone registered for or following this event.
  const recips = await c.env.DB.prepare(
    `SELECT DISTINCT user_id FROM (
       SELECT user_id FROM registrations WHERE event_id = ?
       UNION SELECT user_id FROM saved_events WHERE event_id = ?)`,
  )
    .bind(eventId, eventId)
    .all<{ user_id: string }>();

  const ev = await c.env.DB.prepare("SELECT slug FROM events WHERE id = ?")
    .bind(eventId)
    .first<{ slug: string }>();

  // Notify each recipient (in-app + push/email) without blocking the response.
  c.executionCtx.waitUntil(
    (async () => {
      for (const r of recips.results) {
        await notify(c.env, {
          userId: r.user_id,
          kind: "announcement",
          title: b.title,
          body: b.body,
          href: ev ? `/events/${ev.slug}` : "/app",
          dedupeKey: `ann:${id}:${r.user_id}`,
        });
      }
    })(),
  );

  return c.json({ ok: true, id, recipients: recips.results.length }, 201);
});

// Operator: announcements they've posted (optionally for one event).
comms.get("/sent", async (c) => {
  const { event_id } = c.req.query();
  const where = ["a.operator_id = ?"];
  const binds: unknown[] = [c.var.user!.id];
  if (event_id) (where.push("a.event_id = ?"), binds.push(event_id));
  const { results } = await c.env.DB.prepare(
    `SELECT a.*, e.title AS event_title FROM announcements a
     LEFT JOIN events e ON e.id = a.event_id
     WHERE ${where.join(" AND ")} ORDER BY a.created_at DESC LIMIT 100`,
  )
    .bind(...binds)
    .all();
  return c.json({ announcements: results });
});

// Family: updates for events I'm registered for or have saved.
comms.get("/mine", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT a.id, a.title, a.body, a.urgent, a.created_at, e.title AS event_title, e.slug AS event_slug
     FROM announcements a
     JOIN events e ON e.id = a.event_id
     WHERE a.event_id IN (
       SELECT event_id FROM registrations WHERE user_id = ?
       UNION SELECT event_id FROM saved_events WHERE user_id = ?)
     ORDER BY a.created_at DESC LIMIT 50`,
  )
    .bind(c.var.user!.id, c.var.user!.id)
    .all();
  return c.json({ updates: results });
});

export default comms;
