import type { Env } from "../types";
import { now, parseJson } from "./util";

// Shared cost guard. A per-UTC-day spend counter per external API, stored in the
// ai_cache table (no new schema). Every paid call funnels through tryConsume()
// at a chokepoint (sonar/ask for Perplexity, Civic, Speedhive), so a misconfig
// or abuse can't run away — it stops at the cap. Limits are env-overridable.
//
// Best-effort under D1's read-then-write: this is a guard-rail, not a strict
// transaction. The goal is "can't accidentally spend $1000," not "exactly N."

export type PaidApi = "perplexity" | "civic" | "speedhive";

const DEFAULT_LIMITS: Record<PaidApi, number> = {
  perplexity: 300, // Sonar calls/day across legislation, events, enrich, discovery
  civic: 500, // Google Civic lookups/day (public ZIP endpoint)
  speedhive: 2000, // results syncs/day
};

const ENV_KEY: Record<PaidApi, keyof Env> = {
  perplexity: "BUDGET_PERPLEXITY",
  civic: "BUDGET_CIVIC",
  speedhive: "BUDGET_SPEEDHIVE",
};

function limitFor(env: Env, api: PaidApi): number {
  const v = Number(env[ENV_KEY[api]]);
  return Number.isFinite(v) && v > 0 ? v : DEFAULT_LIMITS[api];
}

const dayStamp = (t = now()) => new Date(t * 1000).toISOString().slice(0, 10);
const budgetKey = (api: PaidApi, day = dayStamp()) => `budget:${api}:${day}`;

/**
 * Try to consume one unit of an API's daily budget. Returns true if allowed
 * (and increments the counter), false if the cap is reached. Call this
 * immediately before a paid request.
 */
export async function tryConsume(env: Env, api: PaidApi, n = 1): Promise<boolean> {
  const key = budgetKey(api);
  const row = await env.DB.prepare("SELECT payload FROM ai_cache WHERE key = ?")
    .bind(key)
    .first<{ payload: string }>();
  const used = row ? Number(parseJson<number>(row.payload, 0)) : 0;
  if (used + n > limitFor(env, api)) return false;
  await env.DB.prepare("INSERT OR REPLACE INTO ai_cache (key, payload, refreshed_at) VALUES (?, ?, ?)")
    .bind(key, JSON.stringify(used + n), now())
    .run();
  return true;
}

/** Today's usage + limit for each paid API — drives the admin cost dashboard. */
export async function budgetStatus(env: Env): Promise<{ api: PaidApi; used: number; limit: number; configured: boolean }[]> {
  const day = dayStamp();
  const configured: Record<PaidApi, boolean> = {
    perplexity: !!env.PERPLEXITY_API_KEY,
    civic: !!env.GOOGLE_CIVIC_API_KEY,
    speedhive: !!env.SPEEDHIVE_API_KEY,
  };
  const out: { api: PaidApi; used: number; limit: number; configured: boolean }[] = [];
  for (const api of Object.keys(DEFAULT_LIMITS) as PaidApi[]) {
    const row = await env.DB.prepare("SELECT payload FROM ai_cache WHERE key = ?")
      .bind(budgetKey(api, day))
      .first<{ payload: string }>();
    out.push({
      api,
      used: row ? Number(parseJson<number>(row.payload, 0)) : 0,
      limit: limitFor(env, api),
      configured: configured[api],
    });
  }
  return out;
}

/**
 * Lightweight fixed-window rate limit (per key, e.g. an IP). Returns true if
 * the request is allowed. Stored in ai_cache; coarse but enough to stop a
 * scraper hammering a public paid endpoint.
 */
export async function rateLimit(env: Env, bucket: string, max: number, windowSec: number): Promise<boolean> {
  const t = now();
  const win = Math.floor(t / windowSec);
  const key = `rl:${bucket}:${win}`;
  const row = await env.DB.prepare("SELECT payload FROM ai_cache WHERE key = ?")
    .bind(key)
    .first<{ payload: string }>();
  const count = row ? Number(parseJson<number>(row.payload, 0)) : 0;
  if (count >= max) return false;
  await env.DB.prepare("INSERT OR REPLACE INTO ai_cache (key, payload, refreshed_at) VALUES (?, ?, ?)")
    .bind(key, JSON.stringify(count + 1), t)
    .run();
  return true;
}
