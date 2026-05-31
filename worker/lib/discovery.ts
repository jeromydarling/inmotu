import type { Env } from "../types";
import { now, uid, parseJson } from "./util";
import { ingestEvents, type FeedEvent } from "../ingest";
import { tryConsume } from "./budget";

// inmotu local-discovery engine — stretch Perplexity into the data nobody's
// captured: the beginner-friendly events AND the local clubs/crews for every
// sector × region. On-demand + cached (we spend only where there's interest).
//
// Trust model (deliberate, see PRD): crews are ORGS ONLY — clubs, teams,
// series, track programs, community groups — never private individuals. Every
// AI-found record is cited and `needs_review = 1` (verify-gated): contact info
// is shown as "unverified — tap the source to confirm", never as gospel.
//
// This module owns its own Perplexity call so it can choose the model per pass
// (deeper/cited `sonar-pro` for crews where accuracy matters most) without
// touching the shared client. Degrades gracefully: no key → no-op, callers fall
// back to seeded data.

type Cite = { title?: string; url: string };

interface AskResult {
  content: string;
  citations: Cite[];
}

async function ask(env: Env, model: string, system: string, user: string): Promise<AskResult | null> {
  if (!env.PERPLEXITY_API_KEY) return null;
  // Shares the Perplexity daily budget with legislation/events/enrich.
  if (!(await tryConsume(env, "perplexity"))) {
    console.warn("perplexity daily budget reached — skipping discovery call");
    return null;
  }
  try {
    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.PERPLEXITY_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.1,
      }),
    });
    if (!res.ok) {
      console.error("discovery perplexity error", res.status);
      return null;
    }
    const data = (await res.json()) as any;
    const content: string = data?.choices?.[0]?.message?.content ?? "";
    const raw: any[] = data?.citations ?? data?.search_results ?? [];
    const citations = raw
      .map((c) => (typeof c === "string" ? { url: c } : { title: c.title, url: c.url }))
      .filter((c) => c.url);
    return { content, citations };
  } catch (e) {
    console.error("discovery fetch failed", e);
    return null;
  }
}

function firstJson<T>(s: string, fallback: T): T {
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

// Sector → human label + the discipline slugs its events use.
const SECTOR_INFO: Record<string, { label: string; disciplines: string[]; beginnerExamples: string }> = {
  bmx: { label: "BMX racing (USA BMX)", disciplines: ["bmx"], beginnerExamples: "weeknight practice, beginner clinics, balance-bike classes, try-it days, loaner-bike nights" },
  motocross: { label: "motocross / off-road", disciplines: ["motocross", "off-road"], beginnerExamples: "beginner riding schools, practice days, PW50/50cc classes, youth clinics" },
  drag: { label: "drag racing (NHRA/IHRA/bracket)", disciplines: ["drag"], beginnerExamples: "test-and-tune nights, grudge nights, Jr. Dragster programs, run-what-ya-brung" },
  karting_sprint: { label: "sprint / road-course karting", disciplines: ["karting"], beginnerExamples: "arrive-and-drive, learn-to-race schools, LO206 rookie classes, kart rentals" },
  karting_dirt: { label: "dirt-oval karting", disciplines: ["karting", "short-track"], beginnerExamples: "rookie classes, club race nights welcoming new families" },
  roadrace: { label: "road racing / track days", disciplines: ["road-race", "endurance"], beginnerExamples: "HPDE, Track Night in America, novice track days with coaching" },
  autocross: { label: "autocross", disciplines: ["autocross"], beginnerExamples: "novice autocross days, SCCA region events, ride-alongs" },
};

const STATE_NAMES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado",
  CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho",
  IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana",
  ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota",
  MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire",
  NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota",
  OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island",
  SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont",
  VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming", DC: "Washington DC",
};

const CACHE_TTL = 21 * 86400; // 21 days — local clubs/calendars change slowly

async function cacheGet<T>(env: Env, key: string): Promise<T | null> {
  const row = await env.DB.prepare("SELECT payload, refreshed_at FROM ai_cache WHERE key = ?")
    .bind(key)
    .first<{ payload: string; refreshed_at: number }>();
  if (row && now() - row.refreshed_at < CACHE_TTL) return parseJson<T>(row.payload, null as unknown as T);
  return null;
}
async function cacheSet(env: Env, key: string, payload: unknown): Promise<void> {
  await env.DB.prepare("INSERT OR REPLACE INTO ai_cache (key, payload, refreshed_at) VALUES (?, ?, ?)")
    .bind(key, JSON.stringify(payload), now())
    .run();
}

const DEFAULT_DAILY_BUDGET = 60; // cold discovery runs/day (cost cap)
const LOCK_TTL = 120; // seconds an in-flight lock is honored before it's stale

/**
 * Claim the right to run one cold discovery: enforces a per-UTC-day global cap
 * (cost ceiling) AND a per-slice in-flight lock (no thundering herd on the same
 * cold slice). Returns true only if this caller may proceed. Best-effort under
 * D1's read-then-write; the cap is a guard-rail, not a hard transaction.
 */
async function claimRun(env: Env, sliceKey: string): Promise<boolean> {
  const t = now();

  // 1) Per-slice in-flight lock — skip if another run claimed it recently.
  const lockKey = `disc_lock:${sliceKey}`;
  const lock = await env.DB.prepare("SELECT refreshed_at FROM ai_cache WHERE key = ?")
    .bind(lockKey)
    .first<{ refreshed_at: number }>();
  if (lock && t - lock.refreshed_at < LOCK_TTL) return false;

  // 2) Per-day global budget.
  const budget = Number(env.DISCOVERY_DAILY_BUDGET) || DEFAULT_DAILY_BUDGET;
  const dayKey = `disc_budget:${new Date(t * 1000).toISOString().slice(0, 10)}`;
  const row = await env.DB.prepare("SELECT payload FROM ai_cache WHERE key = ?")
    .bind(dayKey)
    .first<{ payload: string }>();
  const used = row ? Number(parseJson<number>(row.payload, 0)) : 0;
  if (used >= budget) return false;

  // Reserve: bump the day counter and set the slice lock.
  await env.DB.prepare("INSERT OR REPLACE INTO ai_cache (key, payload, refreshed_at) VALUES (?, ?, ?)")
    .bind(dayKey, JSON.stringify(used + 1), t)
    .run();
  await env.DB.prepare("INSERT OR REPLACE INTO ai_cache (key, payload, refreshed_at) VALUES (?, ?, ?)")
    .bind(lockKey, "1", t)
    .run();
  return true;
}

// ── Pass 1: beginner / try-it events ────────────────────────────────────────

export interface DiscoveredBeginnerEvent {
  title: string;
  date?: string;
  track_name?: string;
  city?: string;
  state?: string;
  url?: string;
}

export async function discoverBeginnerEvents(
  env: Env,
  sector: string,
  state: string,
): Promise<{ events: DiscoveredBeginnerEvent[]; citations: Cite[] } | null> {
  const info = SECTOR_INFO[sector];
  if (!info) return null;
  const stateName = STATE_NAMES[state] ?? state;
  const r = await ask(
    env,
    "sonar",
    "You find real, upcoming BEGINNER-friendly motorsports events for first-time families. Output STRICT JSON, no prose. Only cite events you can verify.",
    `Find upcoming ${info.label} events in ${stateName} over the next 90 days that a COMPLETE BEGINNER family could attend — ${info.beginnerExamples}. ` +
      `Prioritize the easy first step, not championship/national events. ` +
      `Return JSON: {"events":[{"title":"","date":"YYYY-MM-DD","track_name":"","city":"","state":"${state}","url":""}]}. ` +
      `Only real events with a verifiable source. If none, return {"events":[]}.`,
  );
  if (!r) return null;
  const parsed = firstJson<{ events?: DiscoveredBeginnerEvent[] }>(r.content, {});
  const events = (parsed.events ?? []).filter((e) => e && e.title).slice(0, 25);
  return { events, citations: r.citations };
}

// ── Pass 2: local crews / clubs (ORGS ONLY, verify-gated) ────────────────────

export interface DiscoveredCrew {
  name: string;
  kind?: string;
  blurb?: string;
  city?: string;
  state?: string;
  website?: string;
  email?: string;
  phone?: string;
  facebook?: string;
  meets?: string;
  beginner_friendly?: boolean;
}

export async function discoverCrews(
  env: Env,
  sector: string,
  state: string,
): Promise<{ crews: DiscoveredCrew[]; citations: Cite[] } | null> {
  const info = SECTOR_INFO[sector];
  if (!info) return null;
  const stateName = STATE_NAMES[state] ?? state;
  // Deeper model for crews — accuracy matters most where being wrong costs trust.
  const r = await ask(
    env,
    "sonar-pro",
    "You are a motorsports community researcher. You find local CLUBS, TEAMS, SERIES, track programs, and community groups — ORGANIZATIONS ONLY, never private individuals. " +
      "Return only PUBLIC organizational contact info (the club's own website/email/phone/Facebook). Never invent contact details. Output STRICT JSON, no prose. Only include what you can verify and cite.",
    `Find local ${info.label} clubs, teams, series, and community groups in ${stateName} that a new family could join or contact. ` +
      `For each, return PUBLIC org contact info only. Return JSON: {"crews":[{"name":"","kind":"club|team|series|track_program|group","blurb":"one line: who they are and who they welcome","city":"","state":"${state}","website":"","email":"","phone":"","facebook":"","meets":"e.g. race nights / season","beginner_friendly":true}]}. ` +
      `Use null for any field you cannot verify — never guess an email or phone. If none, return {"crews":[]}.`,
  );
  if (!r) return null;
  const parsed = firstJson<{ crews?: DiscoveredCrew[] }>(r.content, {});
  const crews = (parsed.crews ?? []).filter((c) => c && c.name).slice(0, 20);
  return { crews, citations: r.citations };
}

// ── Upserts ──────────────────────────────────────────────────────────────────

async function upsertCrews(env: Env, sector: string, state: string, crews: DiscoveredCrew[], citations: Cite[]): Promise<number> {
  const ts = now();
  const cites = JSON.stringify(citations.slice(0, 6));
  let n = 0;
  for (const c of crews) {
    if (!c.name) continue;
    await env.DB.prepare(
      `INSERT INTO crews (id, sector, name, kind, blurb, city, state, website, email, phone, facebook, meets, beginner_friendly, source, citations, needs_review, verified, created_at, refreshed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'perplexity', ?, 1, 0, ?, ?)
       ON CONFLICT(sector, state, name) DO UPDATE SET
         kind=excluded.kind, blurb=excluded.blurb, city=excluded.city,
         website=excluded.website, email=excluded.email, phone=excluded.phone,
         facebook=excluded.facebook, meets=excluded.meets,
         beginner_friendly=excluded.beginner_friendly, citations=excluded.citations,
         refreshed_at=excluded.refreshed_at`,
    )
      .bind(
        uid("crew_"), sector, c.name.slice(0, 120), (c.kind ?? "club"), c.blurb ?? null,
        c.city ?? null, (c.state ?? state).slice(0, 2).toUpperCase(), c.website ?? null, c.email ?? null,
        c.phone ?? null, c.facebook ?? null, c.meets ?? null, c.beginner_friendly ? 1 : 0, cites, ts, ts,
      )
      .run();
    n++;
  }
  return n;
}

// ── On-demand orchestration (cached) ─────────────────────────────────────────

/**
 * Ensure discovery has run for a (sector, state) recently; if cache is cold,
 * pull beginner events + crews from Perplexity, persist them, and warm the
 * cache. Cheap + idempotent: only spends API calls on a cold slice. No-op
 * without a key. Returns counts (0s when cached/unconfigured).
 */
export async function ensureDiscovered(
  env: Env,
  sector: string,
  state: string,
): Promise<{ ran: boolean; events: number; crews: number }> {
  if (!env.PERPLEXITY_API_KEY) return { ran: false, events: 0, crews: 0 };
  if (!SECTOR_INFO[sector] || !STATE_NAMES[state]) return { ran: false, events: 0, crews: 0 };
  const slice = `${sector}:${state}`;
  const key = `discover:${slice}`;
  if (await cacheGet<true>(env, key)) return { ran: false, events: 0, crews: 0 };

  // Cost + concurrency guard: respect the daily budget and per-slice lock.
  if (!(await claimRun(env, slice))) return { ran: false, events: 0, crews: 0 };

  let eventCount = 0;
  let crewCount = 0;

  const ev = await discoverBeginnerEvents(env, sector, state);
  if (ev && ev.events.length) {
    const feed: FeedEvent[] = ev.events.map((e) => ({
      title: e.title,
      discipline: SECTOR_INFO[sector].disciplines[0],
      state: e.state ?? state,
      region: state, // store the 2-letter state in region so Start can find it
      track_name: e.track_name,
      external_url: e.url,
      level: "beginner",
      starts_at: e.date ? Math.floor(new Date(e.date + "T12:00:00Z").getTime() / 1000) : now() + 21 * 86400,
    }));
    const r = await ingestEvents(env, feed, "perplexity", { needsReview: true });
    eventCount = r.upserted;
  }

  const cr = await discoverCrews(env, sector, state);
  if (cr && cr.crews.length) {
    crewCount = await upsertCrews(env, sector, state, cr.crews, cr.citations);
  }

  // Warm the cache even if empty, so we don't re-spend on a barren slice for TTL.
  await cacheSet(env, key, true);
  return { ran: true, events: eventCount, crews: crewCount };
}

/** Read approved (or all, for admin) crews for a sector+state. */
export async function getCrews(
  env: Env,
  sector: string,
  state: string,
  includeUnreviewed = true,
): Promise<any[]> {
  const sql =
    `SELECT id, name, kind, blurb, city, state, website, email, phone, facebook, meets,
            beginner_friendly, citations, needs_review, verified
     FROM crews WHERE sector = ? AND state = ?` +
    (includeUnreviewed ? "" : " AND needs_review = 0") +
    " ORDER BY beginner_friendly DESC, verified DESC, name ASC LIMIT 40";
  const { results } = await env.DB.prepare(sql).bind(sector, state).all<Record<string, any>>();
  return results.map((r) => ({ ...r, citations: parseJson<Cite[]>(r.citations, []) }));
}
