import { Hono } from "hono";
import type { Env, Vars } from "../types";
import { requireAuth } from "../auth/middleware";
import { now } from "../lib/util";
import { err } from "../lib/http";
import { stripe, StripeError, verifyStripeWebhook } from "../lib/stripe";
import { fulfillYearbook } from "../lib/lulu";

// Billing — Stripe Checkout for subscription tiers.
// Prices are resolved from env-configured Stripe Price IDs; the handler
// degrades gracefully when Stripe is not yet configured so the MVP runs.
const billing = new Hono<{ Bindings: Env; Variables: Vars }>();

export const PLANS = {
  family: { label: "inmotu Family", price: "$9.99/mo", priceIdVar: "STRIPE_PRICE_FAMILY" },
  pro: { label: "inmotu Pro / Team", price: "$19.99/mo", priceIdVar: "STRIPE_PRICE_PRO" },
  tower: { label: "The Tower — Operator", price: "from $49/mo", priceIdVar: "STRIPE_PRICE_TOWER" },
} as const;

billing.get("/plans", (c) =>
  c.json({
    plans: Object.entries(PLANS).map(([id, p]) => ({ id, label: p.label, price: p.price })),
  }),
);

billing.post("/checkout", requireAuth, async (c) => {
  const { plan } = await c.req.json().catch(() => ({}));
  if (!plan || !(plan in PLANS)) return err(c, "validation", "Unknown plan");

  const priceId = (c.env as unknown as Record<string, string | undefined>)[
    PLANS[plan as keyof typeof PLANS].priceIdVar
  ];
  if (!c.env.STRIPE_SECRET_KEY || !priceId) {
    return err(
      c,
      "billing_not_configured",
      "Stripe keys not set. Add STRIPE_SECRET_KEY and price IDs via `wrangler secret put`.",
    );
  }

  try {
    // Ensure a Stripe customer exists for this user.
    let customerId = await c.env.DB.prepare("SELECT stripe_customer_id FROM users WHERE id = ?")
      .bind(c.var.user!.id)
      .first<{ stripe_customer_id: string | null }>()
      .then((r) => r?.stripe_customer_id ?? null);

    if (!customerId) {
      const cust = await stripe(c.env, "customers", {
        email: c.var.user!.email,
        name: c.var.user!.full_name,
        "metadata[user_id]": c.var.user!.id,
      });
      customerId = cust.id as string;
      await c.env.DB.prepare("UPDATE users SET stripe_customer_id = ?, updated_at = ? WHERE id = ?")
        .bind(customerId, now(), c.var.user!.id)
        .run();
    }

    const session = await stripe<{ url?: string }>(c.env, "checkout/sessions", {
      mode: "subscription",
      customer: customerId,
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": "1",
      success_url: `${c.env.APP_URL}/app/account?upgraded=1`,
      cancel_url: `${c.env.APP_URL}/pricing`,
      "metadata[user_id]": c.var.user!.id,
      "metadata[plan]": plan,
    });
    if (!session.url) return err(c, "internal", "Stripe did not return a checkout URL");
    return c.json({ url: session.url });
  } catch (e) {
    if (e instanceof StripeError) return err(c, "internal", e.message);
    throw e;
  }
});

// Stripe webhook — keeps the subscriptions table + user plan in sync.
// Signature is verified against STRIPE_WEBHOOK_SECRET; unverified events are
// rejected (fail closed) so a forged POST cannot grant entitlements.
billing.post("/webhook", async (c) => {
  const payload = await c.req.text();
  let event: Record<string, unknown>;
  try {
    event = await verifyStripeWebhook(c.env, payload, c.req.header("Stripe-Signature") ?? null);
  } catch (e) {
    const status = e instanceof StripeError ? e.status : 400;
    return c.json({ error: "webhook_verification_failed" }, status as 400);
  }

  const type = event.type as string;
  const obj = (event.data as { object: Record<string, unknown> })?.object ?? {};
  const meta = (obj.metadata as Record<string, string>) ?? {};

  // One-time yearbook purchases → fulfill via Lulu.
  if (type === "checkout.session.completed" && meta.type === "yearbook" && meta.order_id) {
    await c.env.DB.prepare(
      "UPDATE yearbook_orders SET stripe_session_id = ?, updated_at = ? WHERE id = ?",
    )
      .bind(obj.id as string, now(), meta.order_id)
      .run();
    c.executionCtx.waitUntil(fulfillYearbook(c.env, meta.order_id));
    return c.json({ received: true });
  }

  if (type === "checkout.session.completed" || type?.startsWith("customer.subscription")) {
    const userId = meta.user_id;
    const plan = meta.plan;
    if (userId && plan) {
      await c.env.DB.prepare("UPDATE users SET plan = ?, updated_at = ? WHERE id = ?")
        .bind(plan, now(), userId)
        .run();
    }
  }
  return c.json({ received: true });
});

export default billing;
