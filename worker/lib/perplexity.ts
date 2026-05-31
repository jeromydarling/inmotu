import type { Env } from "../types";
import { now, uid } from "./util";
import { tryConsume } from "./budget";

// Perplexity Sonar (web-grounded, cited) + Google Civic (deterministic rep
// lookup). All functions degrade gracefully: if a key is absent they return
// null and callers fall back to existing seeded data.

const SONAR_MODEL = "sonar"; // fast, cited; "sonar-pro" for deeper queries

interface SonarResult {
  content: string;
  citations: { title?: string; url: string }[];
}

/** Low-level Perplexity chat call returning content + citations. */
export async function sonar(env: Env, system: string, user: string): Promise<SonarResult | null> {
  if (!env.PERPLEXITY_API_KEY) return null;
  // Cost guard: stop at the daily Perplexity cap before spending.
  if (!(await tryConsume(env, "perplexity"))) {
    console.warn("perplexity daily budget reached — skipping call");
    return null;
  }
  try {
    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.PERPLEXITY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: SONAR_MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.1,
      }),
    });
    if (!res.ok) {
      console.error("perplexity error", res.status);
      return null;
    }
    const data = (await res.json()) as any;
    const content: string = data?.choices?.[0]?.message?.content ?? "";
    // Sonar returns citations as an array of URLs (or search_results objects).
    const rawCites: any[] = data?.citations ?? data?.search_results ?? [];
    const citations = rawCites
      .map((c) => (typeof c === "string" ? { url: c } : { title: c.title, url: c.url }))
      .filter((c) => c.url);
    return { content, citations };
  } catch (e) {
    console.error("perplexity fetch failed", e);
    return null;
  }
}

/** Pull the first JSON value out of a possibly-fenced model response. */
export function firstJson<T>(s: string, fallback: T): T {
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fence ? fence[1] : s;
  const start = body.search(/[[{]/);
  if (start === -1) return fallback;
  const sliced = body.slice(start);
  const end = Math.max(sliced.lastIndexOf("]"), sliced.lastIndexOf("}"));
  if (end === -1) return fallback;
  try {
    return JSON.parse(sliced.slice(0, end + 1)) as T;
  } catch {
    return fallback;
  }
}

export interface LegisItem {
  bill_number: string | null;
  title: string;
  status: "introduced" | "committee" | "passed" | "enacted" | "failed";
  summary: string;
  url: string | null;
}

/**
 * Live "Right to Race" legislation for a state, web-grounded + cited.
 * Returns null if Perplexity isn't configured (caller keeps seeded data).
 */
export async function fetchStateLegislation(
  env: Env,
  stateName: string,
): Promise<{ items: LegisItem[]; citations: SonarResult["citations"] } | null> {
  const r = await sonar(
    env,
    "You are a legislative research assistant. Use only current, verifiable sources. Output STRICT JSON, no prose.",
    `Find current "Right to Race" / motorsports facility nuisance-protection legislation in ${stateName} for 2025-2026. ` +
      `Return JSON: {"bills":[{"bill_number":"","title":"","status":"introduced|committee|passed|enacted|failed","summary":"one sentence","url":""}]}. ` +
      `Only include real bills you can cite. If none, return {"bills":[]}.`,
  );
  if (!r) return null;
  const parsed = firstJson<{ bills?: LegisItem[] }>(r.content, {});
  const items = (parsed.bills ?? []).filter((b) => b && b.title && b.status).slice(0, 10);
  return { items, citations: r.citations };
}

export interface DiscoveredEvent {
  title: string;
  date?: string; // ISO
  track_name?: string;
  city?: string;
  state?: string;
  discipline?: string;
  url?: string;
}

/** Discover upcoming grassroots events in a region (best-effort, flagged). */
export async function discoverEvents(
  env: Env,
  region: string,
): Promise<{ events: DiscoveredEvent[]; citations: SonarResult["citations"] } | null> {
  const r = await sonar(
    env,
    "You find real, upcoming amateur/grassroots motorsports events. Output STRICT JSON, no prose.",
    `List upcoming grassroots/amateur motorsports events (motocross, autocross, road racing, karting, short track) in ${region} ` +
      `over the next 60 days. Return JSON: {"events":[{"title":"","date":"YYYY-MM-DD","track_name":"","city":"","state":"","discipline":"","url":""}]}. ` +
      `Use 2-letter state codes. Only events you can cite with a real source. If unsure, omit it.`,
  );
  if (!r) return null;
  const parsed = firstJson<{ events?: DiscoveredEvent[] }>(r.content, {});
  const events = (parsed.events ?? []).filter((e) => e && e.title).slice(0, 40);
  return { events, citations: r.citations };
}

export interface Official {
  name: string;
  office: string;
  party?: string;
  emails?: string[];
  phones?: string[];
  url?: string;
}

/**
 * Resolve a user's state legislators from ZIP via Google Civic (deterministic,
 * accurate). Cached in D1 for 30 days. Returns null if not configured.
 */
export async function lookupLegislators(
  env: Env,
  zip: string,
): Promise<{ state: string | null; officials: Official[] } | null> {
  if (!/^\d{5}$/.test(zip)) return null;

  const cached = await env.DB.prepare(
    "SELECT state, payload, refreshed_at FROM legislator_cache WHERE zip = ?",
  )
    .bind(zip)
    .first<{ state: string | null; payload: string; refreshed_at: number }>();
  if (cached && now() - cached.refreshed_at < 30 * 86400) {
    return { state: cached.state, officials: JSON.parse(cached.payload) };
  }

  if (!env.GOOGLE_CIVIC_API_KEY) return null;
  // Cost guard: public ZIP endpoint — cap daily Civic lookups.
  if (!(await tryConsume(env, "civic"))) {
    console.warn("civic daily budget reached — skipping lookup");
    return null;
  }
  try {
    const url =
      `https://www.googleapis.com/civicinfo/v2/representatives?key=${env.GOOGLE_CIVIC_API_KEY}` +
      `&address=${encodeURIComponent(zip)}&levels=administrativeArea1&roles=legislatorUpperBody&roles=legislatorLowerBody`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as any;
    const officials: Official[] = (data.officials ?? []).map((o: any) => ({
      name: o.name,
      office: "State Legislator",
      party: o.party,
      emails: o.emails,
      phones: o.phones,
      url: o.urls?.[0],
    }));
    // crude state extraction from the normalized input
    const state: string | null = data?.normalizedInput?.state ?? null;
    await env.DB.prepare(
      "INSERT OR REPLACE INTO legislator_cache (zip, state, payload, refreshed_at) VALUES (?, ?, ?, ?)",
    )
      .bind(zip, state, JSON.stringify(officials), now())
      .run();
    return { state, officials };
  } catch (e) {
    console.error("civic lookup failed", e);
    return null;
  }
}

const STATE_NAMES: Record<string, string> = {
  MN: "Minnesota", IA: "Iowa", NC: "North Carolina", TN: "Tennessee", GA: "Georgia",
  IN: "Indiana", KS: "Kansas", MO: "Missouri", OH: "Ohio", TX: "Texas", WI: "Wisconsin",
  PA: "Pennsylvania", VA: "Virginia", MI: "Michigan",
};

/**
 * Cron/admin: refresh live legislation for tracked states via Perplexity and
 * upsert into the legislation table (source='perplexity'). Existing seeded
 * rows for a state are replaced by fresh AI-sourced rows. No-op without a key.
 */
export async function refreshLegislation(
  env: Env,
  states?: string[],
): Promise<{ states: number; bills: number }> {
  if (!env.PERPLEXITY_API_KEY) return { states: 0, bills: 0 };
  const targets = states && states.length ? states : Object.keys(STATE_NAMES);
  let bills = 0;
  let touched = 0;

  for (const code of targets) {
    const stateName = STATE_NAMES[code] ?? code;
    const res = await fetchStateLegislation(env, stateName);
    if (!res) continue;
    touched++;
    const ts = now();
    const cites = JSON.stringify(res.citations.slice(0, 6));

    // Replace prior perplexity rows for this state (keep seed rows as fallback
    // only if AI returned nothing).
    if (res.items.length > 0) {
      await env.DB.prepare("DELETE FROM legislation WHERE state = ? AND source = 'perplexity'")
        .bind(code)
        .run();
      for (const b of res.items) {
        await env.DB.prepare(
          `INSERT INTO legislation (id, state, state_name, bill_number, title, summary, status, url, source, citations, ai_summary, refreshed_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'perplexity', ?, ?, ?, ?)`,
        )
          .bind(uid("leg_"), code, stateName, b.bill_number ?? null, b.title, b.summary, b.status, b.url ?? null, cites, b.summary, ts, ts)
          .run();
        bills++;
      }
      // Hide stale seed rows for states we now have live data for.
      await env.DB.prepare("UPDATE legislation SET refreshed_at = ? WHERE state = ? AND source = 'seed'")
        .bind(ts, code)
        .run();
    }
  }
  return { states: touched, bills };
}

/**
 * Cron/admin: discover events for regions via Perplexity and upsert through
 * the ingest engine, flagged needs_review=1 + source='perplexity'. No-op
 * without a key. Returns counts. Imported here to avoid a cycle.
 */
export async function refreshDiscoveredEvents(
  env: Env,
  regions: string[],
): Promise<{ regions: number; events: number }> {
  if (!env.PERPLEXITY_API_KEY) return { regions: 0, events: 0 };
  const { ingestEvents } = await import("../ingest");
  let total = 0;
  let touched = 0;
  for (const region of regions) {
    const res = await discoverEvents(env, region);
    if (!res) continue;
    touched++;
    const feed = res.events.map((e) => ({
      title: e.title,
      discipline: e.discipline,
      region,
      state: e.state,
      external_url: e.url,
      starts_at: e.date ? Math.floor(new Date(e.date + "T12:00:00Z").getTime() / 1000) : now() + 14 * 86400,
    }));
    const r = await ingestEvents(env, feed, "perplexity", { needsReview: true });
    total += r.upserted;
  }
  return { regions: touched, events: total };
}
