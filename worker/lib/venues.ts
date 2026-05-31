import type { Env } from "../types";
import { now, uid } from "./util";
import { sonar, firstJson } from "./perplexity";

// National venue canvas — the map's foundation. Imports every US motorsports
// facility from OpenStreetMap (free, structured, geocoded, legal) via the
// Overpass API, then normalizes + upserts idempotently by OSM id. This is what
// makes the map full coast-to-coast on day one; events/battles/live-timing are
// layers on top. Degrades gracefully: a failed Overpass call leaves the
// existing venues untouched.

// Public Overpass mirrors (rotated on failure). Overridable via env.
const OVERPASS_MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];

export type VenueCategory = "oval" | "motocross" | "road" | "drag" | "karting" | "circuit";

export interface NormalizedVenue {
  osm_type: string;
  osm_id: string;
  name: string;
  category: VenueCategory;
  disciplines: string[];
  surface?: string;
  city?: string;
  state?: string;
  lat: number;
  lng: number;
  website?: string;
  tags: Record<string, string>;
}

// Overpass QL: every US facility that reads as a motorsports venue. Covers the
// four families — oval/dirt, motocross/off-road, road/autocross, drag/karting —
// via the tags the OSM community actually uses. `out center` gives ways/
// relations a representative lat/lng.
function buildQuery(): string {
  return `[out:json][timeout:180];
area["ISO3166-1"="US"][admin_level=2]->.us;
(
  nwr["sport"="motor"](area.us);
  nwr["sport"="motocross"](area.us);
  nwr["sport"="karting"](area.us);
  nwr["sport"="drag_racing"](area.us);
  nwr["highway"="raceway"](area.us);
  nwr["leisure"="track"]["surface"](area.us)["sport"~"motor|motocross|karting|drag"];
);
out center tags;`;
}

const US_STATE_ABBR = new Set([
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC",
]);

/** Classify an OSM element into one of our venue categories. */
function classify(t: Record<string, string>): { category: VenueCategory; disciplines: string[] } {
  const sport = (t.sport || "").toLowerCase();
  const racing = (t.racing || "").toLowerCase();
  const name = (t.name || "").toLowerCase();
  const d = new Set<string>();
  if (sport) sport.split(/[;,]/).forEach((s) => d.add(s.trim()));

  let category: VenueCategory = "circuit";
  if (sport.includes("motocross") || racing.includes("motocross") || /motocross|\bmx\b/.test(name)) {
    category = "motocross";
  } else if (sport.includes("karting") || /\bkart/.test(name)) {
    category = "karting";
  } else if (sport.includes("drag") || racing.includes("drag") || /drag(way|strip)?/.test(name)) {
    category = "drag";
  } else if (
    /speedway|oval|dirt track|short track|raceway park/.test(name) ||
    (t.oval === "yes")
  ) {
    category = "oval";
  } else if (sport.includes("motor") || t.highway === "raceway") {
    category = "road";
  }
  return { category, disciplines: [...d] };
}

function pickState(t: Record<string, string>): string | undefined {
  const s = (t["addr:state"] || t["is_in:state_code"] || t["is_in:state"] || "").trim().toUpperCase();
  if (US_STATE_ABBR.has(s)) return s;
  return undefined;
}

/** Pull center lat/lng from a node (lat/lon) or way/relation (center.*). */
function coords(el: any): { lat: number; lng: number } | null {
  if (typeof el.lat === "number" && typeof el.lon === "number") return { lat: el.lat, lng: el.lon };
  if (el.center && typeof el.center.lat === "number") return { lat: el.center.lat, lng: el.center.lon };
  return null;
}

function normalize(el: any): NormalizedVenue | null {
  const t: Record<string, string> = el.tags || {};
  const name = t.name || t["name:en"] || t.operator;
  if (!name) return null; // unnamed facilities aren't useful as map pins
  const c = coords(el);
  if (!c) return null;
  const { category, disciplines } = classify(t);
  return {
    osm_type: el.type,
    osm_id: String(el.id),
    name: name.slice(0, 160),
    category,
    disciplines,
    surface: t.surface,
    city: t["addr:city"],
    state: pickState(t),
    lat: c.lat,
    lng: c.lng,
    website: t.website || t["contact:website"] || t.url,
    tags: t,
  };
}

async function runOverpass(env: Env): Promise<any[] | null> {
  const mirrors = env.OVERPASS_URL ? [env.OVERPASS_URL, ...OVERPASS_MIRRORS] : OVERPASS_MIRRORS;
  const body = "data=" + encodeURIComponent(buildQuery());
  for (const url of mirrors) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
      if (!res.ok) {
        console.error("overpass error", res.status, url);
        continue;
      }
      const data = (await res.json()) as any;
      if (Array.isArray(data?.elements)) return data.elements;
    } catch (e) {
      console.error("overpass fetch failed", url, e);
    }
  }
  return null;
}

/**
 * Import US motorsports venues from OpenStreetMap into the venues table.
 * Idempotent: upserts by (osm_type, osm_id). Returns counts. No-op-safe — on
 * Overpass failure it returns { imported: 0, error } and leaves data intact.
 */
export async function importOsmVenues(env: Env): Promise<{ fetched: number; imported: number; error?: string }> {
  const elements = await runOverpass(env);
  if (!elements) return { fetched: 0, imported: 0, error: "overpass_unavailable" };

  const ts = now();
  let imported = 0;
  // Chunk the upserts so a national pull doesn't exceed subrequest limits.
  for (const el of elements) {
    const v = normalize(el);
    if (!v) continue;
    await env.DB.prepare(
      `INSERT INTO venues (id, source, osm_type, osm_id, name, category, disciplines, surface, city, state, lat, lng, website, status, tags, created_at, updated_at)
       VALUES (?, 'osm', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)
       ON CONFLICT(osm_type, osm_id) DO UPDATE SET
         name=excluded.name, category=excluded.category, disciplines=excluded.disciplines,
         surface=excluded.surface, city=excluded.city, state=excluded.state,
         lat=excluded.lat, lng=excluded.lng, website=excluded.website,
         tags=excluded.tags, updated_at=excluded.updated_at`,
    )
      .bind(
        uid("ven_"), v.osm_type, v.osm_id, v.name, v.category, JSON.stringify(v.disciplines),
        v.surface ?? null, v.city ?? null, v.state ?? null, v.lat, v.lng, v.website ?? null,
        JSON.stringify(v.tags), ts, ts,
      )
      .run();
    imported++;
  }
  return { fetched: elements.length, imported };
}

// ── Enrichment ──────────────────────────────────────────────────────────────

/**
 * Enrich venues with Perplexity: a one-line summary, the disciplines they run,
 * their season, and a website if missing. Processes the least-recently-enriched
 * venues first, `limit` per call (cheap, incremental). No-op without a key.
 */
export async function enrichVenues(
  env: Env,
  limit = 12,
): Promise<{ enriched: number; configured: boolean }> {
  if (!env.PERPLEXITY_API_KEY) return { enriched: 0, configured: false };

  const { results } = await env.DB.prepare(
    `SELECT id, name, category, city, state FROM venues
     WHERE status != 'closed'
     ORDER BY enriched_at IS NOT NULL, enriched_at ASC
     LIMIT ?`,
  )
    .bind(limit)
    .all<{ id: string; name: string; category: string; city: string | null; state: string | null }>();

  let enriched = 0;
  for (const v of results) {
    const loc = [v.city, v.state].filter(Boolean).join(", ");
    const r = await sonar(
      env,
      "You are a motorsports venue researcher. Use only verifiable facts. Output STRICT JSON, no prose.",
      `For the motorsports facility "${v.name}"${loc ? ` in ${loc}` : ""}, return JSON: ` +
        `{"summary":"one factual sentence","disciplines":["..."],"season":"e.g. April–October","website":"https://..."}. ` +
        `disciplines = the racing types it hosts (motocross, road racing, autocross, drag, karting, dirt oval, sprint car, etc). ` +
        `Use null for anything you cannot verify. Do not guess a website.`,
    );
    const ts = now();
    if (!r) {
      // mark attempted so we don't loop on the same rows forever
      await env.DB.prepare("UPDATE venues SET enriched_at = ? WHERE id = ?").bind(ts, v.id).run();
      continue;
    }
    const p = firstJson<{ summary?: string; disciplines?: string[]; season?: string; website?: string }>(r.content, {});
    await env.DB.prepare(
      `UPDATE venues SET
         ai_summary = COALESCE(?, ai_summary),
         disciplines = COALESCE(?, disciplines),
         season = COALESCE(?, season),
         website = COALESCE(website, ?),
         enriched_at = ?, updated_at = ?
       WHERE id = ?`,
    )
      .bind(
        p.summary ?? null,
        Array.isArray(p.disciplines) && p.disciplines.length ? JSON.stringify(p.disciplines) : null,
        p.season ?? null,
        p.website && /^https?:\/\//.test(p.website) ? p.website : null,
        ts,
        ts,
        v.id,
      )
      .run();
    enriched++;
  }
  return { enriched, configured: true };
}

// ── Venue ↔ track linking ────────────────────────────────────────────────────

/**
 * Auto-link venues to curated tracks by geo-proximity (within ~2km), so a
 * venue's detail can surface that track's upcoming events + live timing.
 * Idempotent; only fills venues whose track_id is still null.
 */
export async function linkVenuesToTracks(env: Env): Promise<{ linked: number }> {
  const { results: tracks } = await env.DB.prepare(
    "SELECT id, lat, lng FROM tracks WHERE lat IS NOT NULL AND lng IS NOT NULL",
  ).all<{ id: string; lat: number; lng: number }>();
  if (tracks.length === 0) return { linked: 0 };

  const { results: venues } = await env.DB.prepare(
    "SELECT id, lat, lng FROM venues WHERE track_id IS NULL",
  ).all<{ id: string; lat: number; lng: number }>();

  // ~0.02 degrees ≈ 2km; compare squared distance to avoid sqrt.
  const THRESH = 0.02 * 0.02;
  let linked = 0;
  for (const v of venues) {
    let best: { id: string; d: number } | null = null;
    for (const t of tracks) {
      const dLat = v.lat - t.lat;
      const dLng = v.lng - t.lng;
      const d = dLat * dLat + dLng * dLng;
      if (d <= THRESH && (!best || d < best.d)) best = { id: t.id, d };
    }
    if (best) {
      await env.DB.prepare("UPDATE venues SET track_id = ? WHERE id = ?").bind(best.id, v.id).run();
      linked++;
    }
  }
  return { linked };
}
