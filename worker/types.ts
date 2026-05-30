import type { PublicUser } from "@shared/types";

export interface Env {
  DB: D1Database;
  SESSIONS: KVNamespace;
  ASSETS: Fetcher;
  APP_ENV: string;
  APP_URL: string;
  // Secrets (set via `wrangler secret put`):
  SESSION_SECRET?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
}

// Hono context variables
export interface Vars {
  user: PublicUser | null;
  sessionId: string | null;
}
