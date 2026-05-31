import type { Env } from "../types";
import { now, uid, parseJson } from "./util";
import { tryConsume } from "./budget";

// MYLAPS / Speedhive live results. Like the Perplexity/Civic clients, this
// degrades gracefully: an event with no Speedhive id (or a missing/unreachable
// API) simply yields no live data and the UI falls back to stored results.
//
// The official Event Results API is versioned and partly auth-gated, so the
// base URL is centralized + env-overridable (SPEEDHIVE_API_BASE) and the
// normalizers are tolerant of field-name variants across API versions. An
// optional bearer (SPEEDHIVE_API_KEY) is sent when present.

const DEFAULT_BASE = "https://eventresults-api.speedhive.com/api/v0.2.3";

const baseUrl = (env: Env) => (env.SPEEDHIVE_API_BASE || DEFAULT_BASE).replace(/\/$/, "");

/** Normalized session + classification, decoupled from the wire format. */
export interface ResultRow {
  position?: number;
  start_number?: string;
  competitor: string;
  laps?: number;
  total_time?: string;
  best_lap?: string;
  last_lap?: string;
  gap?: string;
  diff?: string;
  status?: string;
}
export interface ResultSession {
  source_session_id: string | null;
  name: string;
  race_class?: string;
  session_type?: string;
  status?: string; // scheduled|running|finished
  started_at?: number;
  rows: ResultRow[];
}

async function shFetch(env: Env, path: string): Promise<any | null> {
  // Cost guard: cap daily Speedhive calls (cheap, but bound it anyway).
  if (!(await tryConsume(env, "speedhive"))) {
    console.warn("speedhive daily budget reached — skipping call");
    return null;
  }
  try {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (env.SPEEDHIVE_API_KEY) headers.Authorization = `Bearer ${env.SPEEDHIVE_API_KEY}`;
    const res = await fetch(`${baseUrl(env)}${path}`, { headers });
    if (!res.ok) {
      console.error("speedhive error", res.status, path);
      return null;
    }
    return await res.json();
  } catch (e) {
    console.error("speedhive fetch failed", e);
    return null;
  }
}

// Wire shapes vary by API version; pick the first present of several aliases.
const pick = (o: any, ...keys: string[]) => {
  for (const k of keys) if (o?.[k] != null && o[k] !== "") return o[k];
  return undefined;
};
const arr = (v: any): any[] => (Array.isArray(v) ? v : Array.isArray(v?.items) ? v.items : []);

function normStatus(s: any): string | undefined {
  const v = String(s ?? "").toLowerCase();
  if (!v) return undefined;
  if (/(finish|complete|official|classified)/.test(v)) return "finished";
  if (/(run|live|active|progress)/.test(v)) return "running";
  if (/dnf|retir/.test(v)) return "dnf";
  if (/dns/.test(v)) return "dns";
  if (/sched|upcom|planned/.test(v)) return "scheduled";
  return v;
}

function normRow(r: any): ResultRow | null {
  const competitor =
    pick(r, "fullName", "name", "competitor", "driverName", "displayName") ??
    pick(r?.competitor, "name", "fullName");
  if (!competitor) return null;
  const posRaw = pick(r, "position", "pos", "rank", "place");
  return {
    position: posRaw != null ? Number(posRaw) : undefined,
    start_number: pick(r, "startNumber", "start_number", "number", "carNumber", "bib")?.toString(),
    competitor: String(competitor),
    laps: ((v) => (v != null ? Number(v) : undefined))(pick(r, "laps", "lapCount", "completedLaps")),
    total_time: pick(r, "totalTime", "total_time", "time", "raceTime")?.toString(),
    best_lap: pick(r, "bestLapTime", "bestLap", "best_lap", "fastestLap")?.toString(),
    last_lap: pick(r, "lastLapTime", "lastLap", "last_lap")?.toString(),
    gap: pick(r, "gap", "gapToLeader", "behind")?.toString(),
    diff: pick(r, "diff", "interval", "gapToNext")?.toString(),
    status: normStatus(pick(r, "status", "state", "classified")),
  };
}

function normSession(s: any, rows: any[]): ResultSession {
  return {
    source_session_id: (pick(s, "id", "sessionId", "session_id") ?? null)?.toString() ?? null,
    name: String(pick(s, "name", "title", "sessionName") ?? "Session"),
    race_class: pick(s, "class", "raceClass", "className", "group")?.toString(),
    session_type: pick(s, "type", "sessionType", "kind")?.toString()?.toLowerCase(),
    status: normStatus(pick(s, "status", "state")),
    started_at: ((v) => {
      if (!v) return undefined;
      const t = Date.parse(String(v));
      return Number.isNaN(t) ? undefined : Math.floor(t / 1000);
    })(pick(s, "startTime", "start_time", "startedAt", "date")),
    rows: rows.map(normRow).filter((r): r is ResultRow => !!r),
  };
}

/**
 * Pull all sessions + their classifications for a Speedhive event id.
 * Returns null when not configured / unreachable so callers can fall back.
 */
export async function fetchEventSessions(env: Env, speedhiveEventId: string): Promise<ResultSession[] | null> {
  // Sessions list (path variants tolerated across API versions).
  const listed =
    (await shFetch(env, `/eventresults/sessions?eventId=${encodeURIComponent(speedhiveEventId)}`)) ??
    (await shFetch(env, `/events/${encodeURIComponent(speedhiveEventId)}/sessions`));
  const sessions = arr(listed ?? listed?.sessions);
  if (!listed || sessions.length === 0) return listed ? [] : null;

  const out: ResultSession[] = [];
  for (const s of sessions) {
    const sid = pick(s, "id", "sessionId", "session_id");
    let rows: any[] = arr(s.classification ?? s.results ?? s.rows);
    if (rows.length === 0 && sid != null) {
      const cls =
        (await shFetch(env, `/eventresults/sessions/${sid}/classification`)) ??
        (await shFetch(env, `/sessions/${sid}/classification`));
      rows = arr(cls ?? cls?.rows ?? cls?.classification ?? cls?.results);
    }
    out.push(normSession(s, rows));
  }
  return out;
}

/** Build number/transponder → riderId maps for best-effort row→rider linkage. */
async function riderIndex(env: Env): Promise<{ byNumber: Map<string, string>; byTransponder: Map<string, string> }> {
  const { results } = await env.DB.prepare(
    "SELECT id, number, transponder FROM riders WHERE number IS NOT NULL OR transponder IS NOT NULL",
  ).all<{ id: string; number: string | null; transponder: string | null }>();
  const numCount = new Map<string, number>();
  const byNumber = new Map<string, string>();
  const byTransponder = new Map<string, string>();
  for (const r of results) {
    if (r.transponder) byTransponder.set(r.transponder, r.id);
    if (r.number) {
      const k = r.number.trim();
      numCount.set(k, (numCount.get(k) ?? 0) + 1);
      byNumber.set(k, r.id);
    }
  }
  // Drop ambiguous numbers (shared by >1 rider) — only link when unambiguous.
  for (const [k, n] of numCount) if (n > 1) byNumber.delete(k);
  return { byNumber, byTransponder };
}

const TTL = 25; // seconds — dedupe rapid refreshes of the same event

/**
 * Sync one event's live results into race_sessions + live_results. Pulls from
 * Speedhive unless `injected` sessions are supplied (operator manual entry /
 * tests). Idempotent: re-syncing updates rows in place. Returns counts.
 */
export async function syncEventResults(
  env: Env,
  eventId: string,
  injected?: ResultSession[],
): Promise<{ linked: boolean; sessions: number; rows: number; live: boolean }> {
  const ev = await env.DB.prepare(
    "SELECT id, speedhive_event_id FROM events WHERE id = ?",
  )
    .bind(eventId)
    .first<{ id: string; speedhive_event_id: string | null }>();
  if (!ev) return { linked: false, sessions: 0, rows: 0, live: false };

  let sessions = injected ?? null;
  let live = false;
  if (!sessions) {
    if (!ev.speedhive_event_id) return { linked: false, sessions: 0, rows: 0, live: false };
    // short cache to avoid hammering when many viewers trigger a refresh
    const cacheKey = `speedhive:${ev.speedhive_event_id}`;
    const cached = await env.DB.prepare("SELECT payload, refreshed_at FROM ai_cache WHERE key = ?")
      .bind(cacheKey)
      .first<{ payload: string; refreshed_at: number }>();
    if (cached && now() - cached.refreshed_at < TTL) {
      sessions = parseJson<ResultSession[]>(cached.payload, []);
    } else {
      sessions = await fetchEventSessions(env, ev.speedhive_event_id);
      if (sessions) {
        await env.DB.prepare(
          "INSERT OR REPLACE INTO ai_cache (key, payload, refreshed_at) VALUES (?, ?, ?)",
        )
          .bind(cacheKey, JSON.stringify(sessions), now())
          .run();
      }
    }
    live = true;
    if (!sessions) return { linked: true, sessions: 0, rows: 0, live: true };
  }

  const source = injected ? "manual" : "speedhive";
  const { byNumber, byTransponder } = await riderIndex(env);
  const ts = now();
  let rowCount = 0;

  for (const s of sessions) {
    // Upsert the session. Prefer source id for identity; fall back to name+class.
    const existing = s.source_session_id
      ? await env.DB.prepare(
          "SELECT id FROM race_sessions WHERE event_id = ? AND source_session_id = ?",
        )
          .bind(eventId, s.source_session_id)
          .first<{ id: string }>()
      : await env.DB.prepare(
          "SELECT id FROM race_sessions WHERE event_id = ? AND name = ? AND IFNULL(race_class,'') = IFNULL(?,'')",
        )
          .bind(eventId, s.name, s.race_class ?? null)
          .first<{ id: string }>();

    const sessionId = existing?.id ?? uid("ses_");
    if (existing) {
      await env.DB.prepare(
        "UPDATE race_sessions SET name=?, race_class=?, session_type=?, status=?, started_at=?, refreshed_at=? WHERE id=?",
      )
        .bind(s.name, s.race_class ?? null, s.session_type ?? null, s.status ?? "scheduled", s.started_at ?? null, ts, sessionId)
        .run();
    } else {
      await env.DB.prepare(
        `INSERT INTO race_sessions (id, event_id, source_session_id, name, race_class, session_type, status, started_at, source, refreshed_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind(sessionId, eventId, s.source_session_id ?? null, s.name, s.race_class ?? null, s.session_type ?? null, s.status ?? "scheduled", s.started_at ?? null, source, ts, ts)
        .run();
    }

    // Replace the classification for this session (cheap + always consistent).
    await env.DB.prepare("DELETE FROM live_results WHERE session_id = ?").bind(sessionId).run();
    for (const r of s.rows) {
      const riderId =
        (r.start_number && byTransponder.get(r.start_number)) ||
        (r.start_number && byNumber.get(r.start_number.trim())) ||
        null;
      await env.DB.prepare(
        `INSERT INTO live_results (id, session_id, rider_id, position, start_number, competitor, laps, total_time, best_lap, last_lap, gap, diff, status, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind(
          uid("lr_"), sessionId, riderId, r.position ?? null, r.start_number ?? null, r.competitor,
          r.laps ?? null, r.total_time ?? null, r.best_lap ?? null, r.last_lap ?? null,
          r.gap ?? null, r.diff ?? null, r.status ?? null, ts,
        )
        .run();
      rowCount++;
    }
  }
  return { linked: true, sessions: sessions.length, rows: rowCount, live };
}

/**
 * Cron: refresh live results for events happening around now that are linked to
 * Speedhive. No-op for events without a link. Returns aggregate counts.
 */
export async function refreshLiveResults(env: Env): Promise<{ events: number; rows: number }> {
  const t = now();
  const { results } = await env.DB.prepare(
    `SELECT id FROM events
     WHERE speedhive_event_id IS NOT NULL
       AND starts_at BETWEEN ? AND ?`,
  )
    .bind(t - 2 * 86400, t + 86400) // yesterday through tomorrow
    .all<{ id: string }>();
  let rows = 0;
  for (const e of results) {
    const r = await syncEventResults(env, e.id);
    rows += r.rows;
  }
  return { events: results.length, rows };
}
