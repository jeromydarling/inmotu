import type { Env } from "../types";
import { now, uid } from "./util";
import { sendPush, type PushSub } from "./webpush";

export interface NotifyInput {
  userId: string;
  kind: "deadline" | "announcement" | "ladder" | "system";
  title: string;
  body?: string;
  href?: string;
  dedupeKey?: string; // if set, won't create a duplicate for the same user
}

/**
 * Create an in-app notification (idempotent on dedupeKey) and fan it out to
 * the user's enabled channels (web push, email). Returns true if a new
 * notification was created, false if it was a dedupe no-op.
 */
export async function notify(env: Env, n: NotifyInput): Promise<boolean> {
  const id = uid("ntf_");
  const dedupe = n.dedupeKey ?? id; // unique fallback never collides
  const res = await env.DB.prepare(
    `INSERT OR IGNORE INTO notifications (id, user_id, kind, title, body, href, dedupe_key, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, n.userId, n.kind, n.title, n.body ?? null, n.href ?? null, dedupe, now())
    .run();
  if (res.meta.changes === 0) return false; // already sent

  // Fan out to external channels (best-effort, never throws).
  await dispatchChannels(env, n);
  return true;
}

async function dispatchChannels(env: Env, n: NotifyInput): Promise<void> {
  const prefs = await env.DB.prepare(
    "SELECT email, notify_email, notify_push FROM users WHERE id = ?",
  )
    .bind(n.userId)
    .first<{ email: string; notify_email: number; notify_push: number }>();
  if (!prefs) return;

  const jobs: Promise<unknown>[] = [];

  if (prefs.notify_push) {
    jobs.push(pushAll(env, n));
  }
  if (prefs.notify_email && env.RESEND_API_KEY) {
    jobs.push(sendEmail(env, prefs.email, n));
  }
  await Promise.allSettled(jobs);
}

async function pushAll(env: Env, n: NotifyInput): Promise<void> {
  if (!env.VAPID_PUBLIC_KEY) return;
  const subs = await env.DB.prepare(
    "SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?",
  )
    .bind(n.userId)
    .all<{ id: string } & PushSub>();
  const payload = JSON.stringify({ title: n.title, body: n.body ?? "", href: n.href ?? "/app" });
  for (const s of subs.results) {
    try {
      const status = await sendPush(env, s, payload);
      if (status === 404 || status === 410) {
        // Subscription expired — clean it up.
        await env.DB.prepare("DELETE FROM push_subscriptions WHERE id = ?").bind(s.id).run();
      }
    } catch {
      // ignore a single failed endpoint
    }
  }
}

async function sendEmail(env: Env, to: string, n: NotifyInput): Promise<void> {
  const from = env.EMAIL_FROM || "inmotu <noreply@inmotu.pro>";
  const link = `${env.APP_URL}${n.href ?? "/app"}`;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject: n.title,
      html: `<div style="font-family:system-ui,sans-serif"><h2>${escapeHtml(n.title)}</h2>${
        n.body ? `<p>${escapeHtml(n.body)}</p>` : ""
      }<p><a href="${link}" style="color:#E63A05;font-weight:600">Open inmotu →</a></p></div>`,
    }),
  });
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Cron sweep: registration-deadline reminders for saved/registered events.
 * Fires once per event per user at the 3-day and 1-day marks (dedupe_key
 * encodes the window so we never double-send).
 */
export async function runDeadlineSweep(env: Env): Promise<{ created: number }> {
  const nowS = now();
  const horizon = nowS + 3 * 86400;
  const rows = await env.DB.prepare(
    `SELECT DISTINCT s.user_id, e.id AS event_id, e.slug, e.title, e.reg_closes_at
     FROM saved_events s
     JOIN events e ON e.id = s.event_id
     JOIN users u ON u.id = s.user_id
     WHERE s.reminder = 1 AND u.notify_deadlines = 1
       AND e.reg_closes_at IS NOT NULL
       AND e.reg_closes_at > ? AND e.reg_closes_at <= ?`,
  )
    .bind(nowS, horizon)
    .all<{ user_id: string; event_id: string; slug: string; title: string; reg_closes_at: number }>();

  let created = 0;
  for (const r of rows.results) {
    const daysLeft = Math.ceil((r.reg_closes_at - nowS) / 86400);
    const window = daysLeft <= 1 ? "1d" : "3d";
    const ok = await notify(env, {
      userId: r.user_id,
      kind: "deadline",
      title: `Registration closing: ${r.title}`,
      body: `Registration closes in ${daysLeft} day${daysLeft === 1 ? "" : "s"}. Don't miss it.`,
      href: `/events/${r.slug}`,
      dedupeKey: `deadline:${r.event_id}:${window}`,
    });
    if (ok) created++;
  }
  return { created };
}
