import type { Env } from "./types";
import { now, uid, slugify } from "./lib/util";

// Event ingestion. Turns The Grid into a live aggregator: a Cron Trigger
// pulls structured JSON feeds (MotorsportReg/MX Sports exports, club feeds)
// and upserts them. Idempotent by slug so re-runs don't duplicate.

export interface FeedEvent {
  id?: string;
  slug?: string;
  title: string;
  discipline?: string;
  body_slug?: string;
  region?: string;
  level?: string;
  age_group?: string;
  starts_at: number;
  ends_at?: number;
  reg_closes_at?: number;
  entry_fee_cents?: number;
  external_url?: string;
  city?: string;
  state?: string;
  track_name?: string;
}

export async function ingestEvents(
  env: Env,
  items: FeedEvent[],
  source: string,
  opts: { needsReview?: boolean } = {},
): Promise<{ upserted: number; skipped: number }> {
  const needsReview = opts.needsReview ? 1 : 0;
  let upserted = 0;
  let skipped = 0;
  for (const it of items) {
    if (!it.title || !it.starts_at) {
      skipped++;
      continue;
    }
    const slug = it.slug || slugify(`${it.title}-${it.state ?? ""}-${it.starts_at}`, { maxLen: 64 });
    const id = it.id || uid("evt_");
    await env.DB.prepare(
      `INSERT INTO events (id, slug, title, discipline, body_slug, region, level, age_group,
         starts_at, ends_at, reg_closes_at, entry_fee_cents, external_url, source, needs_review, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(slug) DO UPDATE SET
         title = excluded.title, starts_at = excluded.starts_at, ends_at = excluded.ends_at,
         reg_closes_at = excluded.reg_closes_at, entry_fee_cents = excluded.entry_fee_cents,
         external_url = excluded.external_url, region = excluded.region, level = excluded.level`,
    )
      .bind(
        id,
        slug,
        it.title,
        it.discipline ?? null,
        it.body_slug ?? source,
        it.region ?? null,
        it.level ?? "club",
        it.age_group ?? "all",
        it.starts_at,
        it.ends_at ?? null,
        it.reg_closes_at ?? null,
        it.entry_fee_cents ?? null,
        it.external_url ?? null,
        source,
        needsReview,
        now(),
      )
      .run();
    upserted++;
  }
  return { upserted, skipped };
}

// Pull every configured feed (INGEST_FEEDS = comma-separated JSON URLs).
export async function ingestFromFeeds(env: Env): Promise<Record<string, unknown>> {
  const feeds = (env.INGEST_FEEDS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const report: Record<string, unknown> = {};
  for (const url of feeds) {
    try {
      const res = await fetch(url, { cf: { cacheTtl: 0 } } as RequestInit);
      const data = (await res.json()) as { source?: string; events?: FeedEvent[] };
      const r = await ingestEvents(env, data.events ?? [], data.source ?? "feed");
      report[url] = r;
    } catch (err) {
      report[url] = { error: String(err) };
    }
  }
  return report;
}
