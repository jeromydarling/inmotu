import type { PublicUser } from "@shared/types";

export interface Env {
  DB: D1Database;
  SESSIONS: KVNamespace;
  ASSETS: Fetcher;
  MEDIA: R2Bucket;
  AI: Ai;
  APP_ENV: string;
  APP_URL: string;
  // Public-ish config (vars):
  MAPBOX_TOKEN?: string; // publishable pk.* token for map tiles
  STRIPE_PRICE_YEARBOOK?: string;
  LULU_ENV?: string; // 'sandbox' | 'production'
  // Secrets (set via `wrangler secret put`):
  SESSION_SECRET?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  LULU_CLIENT_KEY?: string;
  LULU_CLIENT_SECRET?: string;
}

// Hono context variables
export interface Vars {
  user: PublicUser | null;
  sessionId: string | null;
}
