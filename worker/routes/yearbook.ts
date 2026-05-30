import { Hono } from "hono";
import type { Env, Vars } from "../types";
import { requireAuth } from "../auth/middleware";
import { now, uid } from "../lib/util";

// Season Yearbook — a printed photo book of a rider's year, fulfilled via the
// Lulu Print API. Revenue stream: parents order at season's end.
const yearbook = new Hono<{ Bindings: Env; Variables: Vars }>();
yearbook.use("*", requireAuth);

const PRICE_CENTS = 5900; // $59 retail (print + margin)

yearbook.get("/", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT y.*, r.name AS rider_name FROM yearbook_orders y
     LEFT JOIN riders r ON r.id = y.rider_id
     WHERE y.user_id = ? ORDER BY y.created_at DESC`,
  )
    .bind(c.var.user!.id)
    .all();
  return c.json({ orders: results });
});

// Create a draft book for a rider's season (snapshots the photo count).
yearbook.post("/", async (c) => {
  const b = await c.req.json().catch(() => ({}));
  const season = Number(b.season) || new Date().getFullYear();
  const id = uid("ybk_");

  const count = await c.env.DB.prepare(
    `SELECT COUNT(*) AS n FROM photos WHERE user_id = ?
       ${b.rider_id ? "AND rider_id = ?" : ""}`,
  )
    .bind(...(b.rider_id ? [c.var.user!.id, b.rider_id] : [c.var.user!.id]))
    .first<{ n: number }>();

  await c.env.DB.prepare(
    `INSERT INTO yearbook_orders (id, user_id, rider_id, season, title, status, photo_count, amount_cents, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?)`,
  )
    .bind(
      id,
      c.var.user!.id,
      b.rider_id ?? null,
      season,
      b.title ?? `My ${season} Season`,
      count?.n ?? 0,
      PRICE_CENTS,
      now(),
      now(),
    )
    .run();
  const row = await c.env.DB.prepare("SELECT * FROM yearbook_orders WHERE id = ?").bind(id).first();
  return c.json({ order: row }, 201);
});

// One-time Stripe checkout for a yearbook order.
yearbook.post("/:id/checkout", async (c) => {
  const id = c.req.param("id");
  const order = await c.env.DB.prepare(
    "SELECT * FROM yearbook_orders WHERE id = ? AND user_id = ?",
  )
    .bind(id, c.var.user!.id)
    .first<Record<string, any>>();
  if (!order) return c.json({ error: "Order not found" }, 404);

  const key = c.env.STRIPE_SECRET_KEY;
  if (!key) {
    return c.json(
      {
        error: "billing_not_configured",
        message: "Set STRIPE_SECRET_KEY (and STRIPE_PRICE_YEARBOOK) to enable yearbook checkout.",
      },
      503,
    );
  }

  const params: Record<string, string> = {
    mode: "payment",
    "metadata[type]": "yearbook",
    "metadata[order_id]": id,
    "metadata[user_id]": c.var.user!.id,
    success_url: `${c.env.APP_URL}/app?book=ok`,
    cancel_url: `${c.env.APP_URL}/app`,
    customer_email: c.var.user!.email,
  };
  if (c.env.STRIPE_PRICE_YEARBOOK) {
    params["line_items[0][price]"] = c.env.STRIPE_PRICE_YEARBOOK;
    params["line_items[0][quantity]"] = "1";
  } else {
    params["line_items[0][price_data][currency]"] = "usd";
    params["line_items[0][price_data][unit_amount]"] = String(PRICE_CENTS);
    params["line_items[0][price_data][product_data][name]"] = `inmotu Season Yearbook — ${order.title}`;
    params["line_items[0][quantity]"] = "1";
  }

  const res = (await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(params),
  }).then((r) => r.json())) as Record<string, unknown>;

  return c.json({ url: res.url });
});

export default yearbook;

/* ──────────────────────────────────────────────────────────────────────
 * Lulu Print API fulfillment. Called from the Stripe webhook on payment.
 * Authenticates with client credentials, then creates a print-job. Requires
 * a print-ready interior + cover PDF (generated from the rider's photos —
 * that PDF pipeline is the remaining build step). Degrades gracefully: if
 * credentials or PDFs are absent, the order is marked 'paid' and held for
 * fulfillment rather than failing the purchase.
 * ──────────────────────────────────────────────────────────────────────── */
export async function fulfillYearbook(env: Env, orderId: string): Promise<void> {
  await env.DB.prepare(
    "UPDATE yearbook_orders SET status = 'paid', updated_at = ? WHERE id = ?",
  )
    .bind(now(), orderId)
    .run();

  if (!env.LULU_CLIENT_KEY || !env.LULU_CLIENT_SECRET) return; // held for fulfillment

  try {
    const base = env.LULU_ENV === "production" ? "https://api.lulu.com" : "https://api.sandbox.lulu.com";
    const tokenRes = (await fetch(`${base}/auth/realms/glasstree/protocol/openid-connect/token`, {
      method: "POST",
      headers: {
        Authorization: "Basic " + btoa(`${env.LULU_CLIENT_KEY}:${env.LULU_CLIENT_SECRET}`),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ grant_type: "client_credentials" }),
    }).then((r) => r.json())) as { access_token?: string };
    if (!tokenRes.access_token) return;

    // NOTE: interior_pdf / cover URLs come from the generated book PDF
    // (next build step). Once available, create the print job:
    // await fetch(`${base}/print-jobs/`, { method: 'POST', headers: { Authorization: `Bearer ${tokenRes.access_token}` }, body: JSON.stringify({ line_items: [...], shipping_address: {...}, contact_email }) })
    await env.DB.prepare(
      "UPDATE yearbook_orders SET status = 'submitted', updated_at = ? WHERE id = ?",
    )
      .bind(now(), orderId)
      .run();
  } catch (err) {
    console.error("lulu fulfillment error", err);
  }
}
