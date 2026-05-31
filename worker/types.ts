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
  INGEST_FEEDS?: string; // comma-separated JSON feed URLs for event ingestion
  VAPID_PUBLIC_KEY?: string; // web-push public key (safe to expose to client)
  EMAIL_FROM?: string; // from address for email notifications
  // Secrets (set via `wrangler secret put`):
  SESSION_SECRET?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  LULU_CLIENT_KEY?: string;
  LULU_CLIENT_SECRET?: string;
  VAPID_PRIVATE_KEY?: string; // web-push private key
  RESEND_API_KEY?: string; // email provider key (Resend)
  PERPLEXITY_API_KEY?: string; // Perplexity Sonar — live legislation + event discovery
  GOOGLE_CIVIC_API_KEY?: string; // legislator lookup by address/ZIP
  SPEEDHIVE_API_BASE?: string; // override Speedhive Event Results API base URL/version
  SPEEDHIVE_API_KEY?: string; // optional bearer for MYLAPS/Speedhive results API
}

// Hono context variables
export interface Vars {
  user: PublicUser | null;
  sessionId: string | null;
}
