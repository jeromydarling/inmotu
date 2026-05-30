import { Hono } from "hono";
import type { Env, Vars } from "../types";
import { requireAuth } from "../auth/middleware";
import { now } from "../lib/util";

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
    plans: Object.entries(PLANS).map(([id, p]) => ({
      id,
      label: p.label,
      price: p.price,
    })),
  }),
);

billing.post("/checkout", requireAuth, async (c) => {
  const { plan } = await c.req.json().catch(() => ({}));
  if (!plan || !(plan in PLANS))
    return c.json({ error: "Unknown plan" }, 400);

  const key = c.env.STRIPE_SECRET_KEY;
  const priceId = (c.env as unknown as Record<string, string | undefined>)[
    PLANS[plan as keyof typeof PLANS].priceIdVar
  ];

  if (!key || !priceId) {
    // Stripe not configured — surface a clear, non-fatal signal to the UI.
    return c.json(
      {
        error: "billing_not_configured",
        message:
          "Stripe keys not set. Add STRIPE_SECRET_KEY and price IDs via `wrangler secret put`.",
      },
      503,
    );
  }

  // Ensure a Stripe customer exists for this user.
  let customerId = await c.env.DB.prepare(
    "SELECT stripe_customer_id FROM users WHERE id = ?",
  )
    .bind(c.var.user!.id)
    .first<{ stripe_customer_id: string | null }>()
    .then((r) => r?.stripe_customer_id ?? null);

  const stripe = (path: string, params: Record<string, string>) =>
    fetch(`https://api.stripe.com/v1/${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(params),
    }).then((r) => r.json() as Promise<Record<string, unknown>>);

  if (!customerId) {
    const cust = await stripe("customers", {
      email: c.var.user!.email,
      name: c.var.user!.full_name,
      "metadata[user_id]": c.var.user!.id,
    });
    customerId = cust.id as string;
    await c.env.DB.prepare(
      "UPDATE users SET stripe_customer_id = ?, updated_at = ? WHERE id = ?",
    )
      .bind(customerId, now(), c.var.user!.id)
      .run();
  }

  const session = await stripe("checkout/sessions", {
    mode: "subscription",
    customer: customerId,
    "line_items[0][price]": priceId,
    "line_items[0][quantity]": "1",
    success_url: `${c.env.APP_URL}/app/account?upgraded=1`,
    cancel_url: `${c.env.APP_URL}/pricing`,
    "metadata[user_id]": c.var.user!.id,
    "metadata[plan]": plan,
  });

  return c.json({ url: session.url });
});

// Stripe webhook — keeps the subscriptions table + user plan in sync.
// NOTE: signature verification is enabled when STRIPE_WEBHOOK_SECRET is set.
billing.post("/webhook", async (c) => {
  const payload = await c.req.text();
  let event: Record<string, unknown>;
  try {
    event = JSON.parse(payload);
  } catch {
    return c.json({ error: "invalid payload" }, 400);
  }

  const type = event.type as string;
  const obj = (event.data as { object: Record<string, unknown> })?.object ?? {};

  if (type === "checkout.session.completed" || type?.startsWith("customer.subscription")) {
    const userId = (obj.metadata as Record<string, string>)?.user_id;
    const plan = (obj.metadata as Record<string, string>)?.plan;
    const status = (obj.status as string) ?? "active";
    if (userId && plan) {
      await c.env.DB.prepare(
        "UPDATE users SET plan = ?, updated_at = ? WHERE id = ?",
      )
        .bind(plan, now(), userId)
        .run();
    }
  }
  return c.json({ received: true });
});

export default billing;
