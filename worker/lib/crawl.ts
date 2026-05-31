import type { Env } from "../types";
import { generateText } from "./ai";
import { ingestEvents, type FeedEvent } from "../ingest";
import { now, parseJson } from "./util";

/** Pull the first JSON array/object out of a model response (handles fences). */
function extractJsonArray<T>(s: string, fallback: T): T {
  const fenced = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : s;
  const start = candidate.search(/[[{]/);
  if (start === -1) return fallback;
  const sliced = candidate.slice(start);
  const lastClose = Math.max(sliced.lastIndexOf("]"), sliced.lastIndexOf("}"));
  if (lastClose === -1) return fallback;
  return parseJson<T>(sliced.slice(0, lastClose + 1), fallback);
}

// Event crawler — turns arbitrary web pages (track schedules, club calendars,
// aggregators) into reviewable events. CF-native first, Firecrawl-pluggable:
//
//   provider precedence per source:
//     1. "firecrawl"  → Firecrawl scrape API   (only if FIRECRAWL_API_KEY set)
//     2. Cloudflare Browser Rendering /markdown (if account id + token set)
//     3. plain fetch + HTML→text strip          (always; great for SSR pages)
//
// Everything degrades: a source that can't be fetched is skipped, never throws.
// Extracted events are flagged needs_review so nothing AI-sourced goes live
// unverified (same contract as Perplexity discovery).

export type CrawlProvider = "auto" | "firecrawl" | "browser" | "fetch";

export interface CrawlSource {
  url: string;
  region?: string;
  discipline?: string;
  provider?: CrawlProvider;
}

/** Strip a raw HTML document down to readable text (cheap, dependency-free). */
function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/(p|div|li|tr|h[1-6]|section|article)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim();
}

async function viaFirecrawl(env: Env, url: string): Promise<string | null> {
  if (!env.FIRECRAWL_API_KEY) return null;
  try {
    const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true }),
    });
    if (!res.ok) {
      console.error("firecrawl error", res.status, url);
      return null;
    }
    const data = (await res.json()) as any;
    return data?.data?.markdown ?? data?.markdown ?? null;
  } catch (e) {
    console.error("firecrawl fetch failed", e);
    return null;
  }
}

async function viaBrowserRendering(env: Env, url: string): Promise<string | null> {
  if (!env.CLOUDFLARE_ACCOUNT_ID || !env.CLOUDFLARE_API_TOKEN) return null;
  try {
    const endpoint = `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/browser-rendering/markdown`;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url }),
    });
    if (!res.ok) {
      console.error("browser-rendering error", res.status, url);
      return null;
    }
    const data = (await res.json()) as any;
    // REST returns { success, result } where result is the markdown string.
    const md = typeof data?.result === "string" ? data.result : data?.result?.markdown;
    return md ?? null;
  } catch (e) {
    console.error("browser-rendering fetch failed", e);
    return null;
  }
}

async function viaPlainFetch(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "inmotuBot/1.0 (+https://inmotu.pro)" },
    });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    const body = await res.text();
    if (ct.includes("application/json")) return body.slice(0, 20000);
    return htmlToText(body).slice(0, 20000);
  } catch (e) {
    console.error("plain fetch failed", e);
    return null;
  }
}

/**
 * Fetch a page's content as text/markdown using the best available provider.
 * `provider` forces a specific path; "auto" tries browser then falls back to
 * plain fetch. Firecrawl is only used when explicitly requested.
 */
export async function fetchPageContent(
  env: Env,
  url: string,
  provider: CrawlProvider = "auto",
): Promise<{ content: string; via: string } | null> {
  if (provider === "firecrawl") {
    const c = await viaFirecrawl(env, url);
    if (c) return { content: c, via: "firecrawl" };
    // fall through to auto if firecrawl unavailable
  }
  if (provider === "browser" || provider === "auto") {
    const c = await viaBrowserRendering(env, url);
    if (c) return { content: c, via: "browser" };
  }
  const c = await viaPlainFetch(url);
  if (c) return { content: c, via: "fetch" };
  return null;
}

/** Extract events from page text via Workers AI (reuses the import contract). */
export async function extractEvents(
  env: Env,
  content: string,
  ctx: { region?: string; discipline?: string },
): Promise<FeedEvent[]> {
  if (!content.trim()) return [];
  const sys =
    "You extract grassroots motorsports events from page text. Output STRICT JSON only — a single JSON array, no prose. " +
    "Each item: {title, discipline, starts_at (unix seconds, UTC noon), city, state, track_name, external_url, entry_fee_cents}. " +
    "Use 2-letter state codes. Use null for unknown fields. Infer the year as 2026 if not stated. " +
    "Only include real events with a date; skip navigation, ads, and past events. If none, return [].";
  const raw = await generateText(env, sys, content.slice(0, 12000));
  const items = extractJsonArray<any[]>(raw, []);
  return (items ?? [])
    .filter((e: any) => e && e.title && e.starts_at)
    .map((e: any) => ({
      title: String(e.title),
      discipline: e.discipline ?? ctx.discipline ?? undefined,
      region: ctx.region ?? undefined,
      state: e.state ?? undefined,
      city: e.city ?? undefined,
      track_name: e.track_name ?? undefined,
      external_url: e.external_url ?? undefined,
      entry_fee_cents: typeof e.entry_fee_cents === "number" ? e.entry_fee_cents : undefined,
      starts_at: Number(e.starts_at),
    }))
    .filter((e: FeedEvent) => Number.isFinite(e.starts_at) && e.starts_at > now() - 86400);
}

/**
 * Crawl configured sources (or a provided list): fetch → extract → upsert as
 * needs_review events tagged source='crawl'. Returns per-source counts.
 */
export async function crawlSources(
  env: Env,
  sources?: CrawlSource[],
): Promise<{ sources: number; events: number; report: any[] }> {
  const list =
    sources ??
    (() => {
      try {
        return JSON.parse(env.CRAWL_SOURCES ?? "[]") as CrawlSource[];
      } catch {
        return [];
      }
    })();

  const report: any[] = [];
  let total = 0;
  for (const s of list) {
    if (!s?.url) continue;
    const page = await fetchPageContent(env, s.url, s.provider ?? "auto");
    if (!page) {
      report.push({ url: s.url, ok: false, via: null, events: 0 });
      continue;
    }
    const events = await extractEvents(env, page.content, { region: s.region, discipline: s.discipline });
    const r = await ingestEvents(env, events, "crawl", { needsReview: true });
    total += r.upserted;
    report.push({ url: s.url, ok: true, via: page.via, found: events.length, upserted: r.upserted });
  }
  return { sources: list.length, events: total, report };
}
