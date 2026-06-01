import type { Env } from "../types";

// Smoke test — one lightweight live probe per paid engine so an admin can
// confirm, in production, that each key actually works end-to-end (not just
// "configured"). Each probe makes a single real request and reports a clear
// status. Deliberately bypasses the daily budget counter (these are rare,
// admin-triggered health checks, not user traffic).

export type SmokeStatus = "ok" | "fail" | "skipped";
export interface SmokeResult {
  engine: string;
  status: SmokeStatus;
  detail: string;
  ms?: number;
}

async function timed<T>(fn: () => Promise<T>): Promise<{ v: T; ms: number }> {
  const t0 = Date.now();
  const v = await fn();
  return { v, ms: Date.now() - t0 };
}

/** Read an error response body (text) so the smoke detail shows the real reason. */
async function errBody(res: Response): Promise<string> {
  try {
    const t = (await res.text()).replace(/\s+/g, " ").trim();
    return t ? ` — ${t.slice(0, 180)}` : "";
  } catch {
    return "";
  }
}

// Perplexity: tiny cited query; pass if we get a 200 with content.
async function probePerplexity(env: Env): Promise<SmokeResult> {
  if (!env.PERPLEXITY_API_KEY) return { engine: "perplexity", status: "skipped", detail: "no key" };
  try {
    const { v: res, ms } = await timed(() =>
      fetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${env.PERPLEXITY_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "sonar",
          messages: [{ role: "user", content: "Reply with the single word: ok" }],
          max_tokens: 5,
          temperature: 0,
        }),
      }),
    );
    if (!res.ok) return { engine: "perplexity", status: "fail", detail: `HTTP ${res.status}${await errBody(res)}`, ms };
    const data = (await res.json()) as any;
    const txt = data?.choices?.[0]?.message?.content ?? "";
    return { engine: "perplexity", status: "ok", detail: `responded: "${String(txt).slice(0, 24)}"`, ms };
  } catch (e) {
    return { engine: "perplexity", status: "fail", detail: String(e).slice(0, 80) };
  }
}

// Google Civic: a known-valid ZIP; pass on 200 (even if empty officials).
async function probeCivic(env: Env): Promise<SmokeResult> {
  if (!env.GOOGLE_CIVIC_API_KEY) return { engine: "civic", status: "skipped", detail: "no key" };
  try {
    const { v: res, ms } = await timed(() =>
      fetch(
        `https://www.googleapis.com/civicinfo/v2/representatives?key=${env.GOOGLE_CIVIC_API_KEY}` +
          `&address=20500&levels=administrativeArea1&roles=legislatorUpperBody`,
      ),
    );
    if (!res.ok) return { engine: "civic", status: "fail", detail: `HTTP ${res.status}${await errBody(res)}`, ms };
    const data = (await res.json()) as any;
    return { engine: "civic", status: "ok", detail: `${(data.officials ?? []).length} officials for 20500`, ms };
  } catch (e) {
    return { engine: "civic", status: "fail", detail: String(e).slice(0, 80) };
  }
}

// Speedhive: hit the configured base; any HTTP response means reachable.
async function probeSpeedhive(env: Env): Promise<SmokeResult> {
  if (!env.SPEEDHIVE_API_KEY) return { engine: "speedhive", status: "skipped", detail: "no key" };
  const base = (env.SPEEDHIVE_API_BASE || "https://eventresults-api.speedhive.com/api/v0.2.3").replace(/\/$/, "");
  try {
    const { v: res, ms } = await timed(() =>
      fetch(`${base}/eventresults/sessions?eventId=1`, {
        headers: { Accept: "application/json", Authorization: `Bearer ${env.SPEEDHIVE_API_KEY}` },
      }),
    );
    // 2xx/4xx = reachable + auth processed; 401/403 = bad key.
    if (res.status === 401 || res.status === 403) return { engine: "speedhive", status: "fail", detail: `auth rejected (HTTP ${res.status})`, ms };
    return { engine: "speedhive", status: "ok", detail: `reachable (HTTP ${res.status})`, ms };
  } catch (e) {
    return { engine: "speedhive", status: "fail", detail: String(e).slice(0, 80) };
  }
}

// Workers AI: tiny generation; pass if the binding returns text.
async function probeWorkersAI(env: Env): Promise<SmokeResult> {
  if (!env.AI) return { engine: "workers_ai", status: "skipped", detail: "no binding" };
  try {
    const { v, ms } = await timed(() =>
      env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {
        messages: [{ role: "user", content: "Reply with the single word: ok" }],
        max_tokens: 5,
      }) as Promise<{ response?: string }>,
    );
    return { engine: "workers_ai", status: "ok", detail: `responded: "${String(v.response ?? "").trim().slice(0, 24)}"`, ms };
  } catch (e) {
    return { engine: "workers_ai", status: "fail", detail: String(e).slice(0, 80) };
  }
}

// Cloudflare Browser Rendering (REST): markdown a stable page.
async function probeBrowser(env: Env): Promise<SmokeResult> {
  if (!env.CLOUDFLARE_ACCOUNT_ID || !env.CLOUDFLARE_API_TOKEN) return { engine: "browser", status: "skipped", detail: "no creds" };
  try {
    const { v: res, ms } = await timed(() =>
      fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/browser-rendering/markdown`, {
        method: "POST",
        headers: { Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com" }),
      }),
    );
    if (!res.ok) return { engine: "browser", status: "fail", detail: `HTTP ${res.status}`, ms };
    return { engine: "browser", status: "ok", detail: "rendered example.com", ms };
  } catch (e) {
    return { engine: "browser", status: "fail", detail: String(e).slice(0, 80) };
  }
}

// Firecrawl: scrape a stable page.
async function probeFirecrawl(env: Env): Promise<SmokeResult> {
  if (!env.FIRECRAWL_API_KEY) return { engine: "firecrawl", status: "skipped", detail: "no key" };
  try {
    const { v: res, ms } = await timed(() =>
      fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: { Authorization: `Bearer ${env.FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com", formats: ["markdown"] }),
      }),
    );
    if (!res.ok) return { engine: "firecrawl", status: "fail", detail: `HTTP ${res.status}`, ms };
    return { engine: "firecrawl", status: "ok", detail: "scraped example.com", ms };
  } catch (e) {
    return { engine: "firecrawl", status: "fail", detail: String(e).slice(0, 80) };
  }
}

/** Run every engine probe in parallel and return per-engine results. */
export async function runSmoke(env: Env): Promise<SmokeResult[]> {
  return Promise.all([
    probePerplexity(env),
    probeCivic(env),
    probeSpeedhive(env),
    probeWorkersAI(env),
    probeBrowser(env),
    probeFirecrawl(env),
  ]);
}
