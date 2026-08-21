import { Hono } from "hono";
import type { Env, Vars } from "../types";
import { handleStripeEvent } from "./billing";

// CROS federation Stripe receiver.
//
// The CROS hub receives all Stripe events centrally and forwards each app's
// events as a JSON envelope { hub_event_id, satellite_app, stripe_event,
// delivered_at } signed with a shared secret. This route verifies the hub's
// HMAC over the exact raw body bytes, then hands the unwrapped Stripe event
// to handleStripeEvent — the same code path the direct Stripe webhook runs
// after its own signature verification, so the two paths cannot drift.

async function hmacHex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Constant-time hex comparison (XOR accumulate) — never `===` on a MAC.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const stripeRoutes = new Hono<{ Bindings: Env; Variables: Vars }>();

stripeRoutes.post("/federation-in", async (c) => {
  // Raw body first — the hub's signature covers the exact bytes.
  const raw = await c.req.text();

  const secret = c.env.FEDERATION_STRIPE_SECRET;
  if (!secret) return c.json({ ok: false, error: "federation_not_configured" }, 500); // fail closed

  const given = c.req.header("X-CROS-Federation-Signature");
  if (!given) return c.json({ ok: false, error: "missing_federation_signature" }, 400);

  const expected = await hmacHex(secret, raw);
  if (!timingSafeEqual(expected, given.toLowerCase()))
    return c.json({ ok: false, error: "invalid_federation_signature" }, 400);

  // Only after verification do we parse the payload.
  let envelope: Record<string, unknown>;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("shape");
    envelope = parsed as Record<string, unknown>;
  } catch {
    return c.json({ ok: false, error: "invalid_envelope" }, 400);
  }

  if (envelope.satellite_app != null && envelope.satellite_app !== "inmotu")
    return c.json({ ok: false, error: "wrong_satellite" }, 400);

  const stripeEvent = envelope.stripe_event;
  if (!stripeEvent || typeof stripeEvent !== "object" || Array.isArray(stripeEvent))
    return c.json({ ok: false, error: "invalid_stripe_event" }, 400);

  try {
    await handleStripeEvent(stripeEvent as Record<string, unknown>, c.env, c.executionCtx);
  } catch (e) {
    console.error("federation-in handler failed:", e);
    return c.json({ ok: false, error: "handler_failed" }, 502);
  }

  return c.json({ ok: true, received: true, hub_event_id: envelope.hub_event_id ?? null });
});

export default stripeRoutes;
