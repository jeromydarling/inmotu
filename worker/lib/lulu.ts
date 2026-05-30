import type { Env } from "../types";
import { now } from "./util";

/**
 * Lulu Print API fulfillment for Season Yearbook orders. Called from the
 * verified Stripe webhook on payment. Authenticates with client credentials,
 * then (once the book PDF pipeline lands) creates a print job. Degrades
 * gracefully: if credentials or PDFs are absent, the order is marked 'paid'
 * and held for fulfillment rather than failing the purchase.
 */
export async function fulfillYearbook(env: Env, orderId: string): Promise<void> {
  await env.DB.prepare(
    "UPDATE yearbook_orders SET status = 'paid', updated_at = ? WHERE id = ?",
  )
    .bind(now(), orderId)
    .run();

  if (!env.LULU_CLIENT_KEY || !env.LULU_CLIENT_SECRET) return; // held for fulfillment

  try {
    const base =
      env.LULU_ENV === "production" ? "https://api.lulu.com" : "https://api.sandbox.lulu.com";
    const tokenRes = (await fetch(
      `${base}/auth/realms/glasstree/protocol/openid-connect/token`,
      {
        method: "POST",
        headers: {
          Authorization: "Basic " + btoa(`${env.LULU_CLIENT_KEY}:${env.LULU_CLIENT_SECRET}`),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ grant_type: "client_credentials" }),
      },
    ).then((r) => r.json())) as { access_token?: string };
    if (!tokenRes.access_token) return;

    // NOTE: interior_pdf / cover URLs come from the generated book PDF (next
    // build step). Once available, POST `${base}/print-jobs/` with line_items,
    // shipping_address, and contact_email here.
    await env.DB.prepare(
      "UPDATE yearbook_orders SET status = 'submitted', updated_at = ? WHERE id = ?",
    )
      .bind(now(), orderId)
      .run();
  } catch (err) {
    console.error("lulu fulfillment error", err);
  }
}
