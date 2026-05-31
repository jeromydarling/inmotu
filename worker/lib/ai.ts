import type { Env } from "../types";

const TEXT_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

/** Run a system+user prompt through Workers AI and return the text response. */
export async function generateText(
  env: Env,
  system: string,
  user: string,
): Promise<string> {
  const res = (await env.AI.run(TEXT_MODEL, {
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    max_tokens: 800,
  })) as { response?: string };
  return (res.response ?? "").trim();
}

const VOICE =
  "You are a marketing copywriter for inmotu, a grassroots motorsports platform. " +
  "Write with warmth and community spirit — the paddock is a family. Be authentic, " +
  "concrete, and energetic, never corporate or cheesy. No hashtags unless asked. " +
  "No emojis unless asked. Keep it tight.";

export type AssetKind = "social" | "event_promo" | "sponsor_thanks" | "press" | "recap";

interface AssetReq {
  kind: AssetKind;
  // free-form facts the user supplied or we pulled from their data
  subject: string; // who/what this is about (team, rider, track, event)
  details?: string; // results, dates, location, sponsor name, etc.
  tone?: string; // optional override
  withHashtags?: boolean;
}

const KIND_INSTRUCTIONS: Record<AssetKind, string> = {
  social:
    "Write 3 distinct short social media posts (each 1-3 sentences). Separate them with a line of '---'. Make them shareable and proud.",
  event_promo:
    "Write a punchy event promotion: a 1-line hook headline, then 2-3 sentences of body that make people want to show up. Put the headline on its own first line.",
  sponsor_thanks:
    "Write a warm, specific public thank-you to the named sponsor that a racing family would post. 2-3 sentences. Make the sponsor look good.",
  press:
    "Write a short press blurb / announcement (3-4 sentences) in third person, suitable for a local paper or newsletter.",
  recap:
    "Write an exciting race-day recap (4-6 sentences) celebrating the weekend. First person plural ('we'). Specific and heartfelt.",
};

export async function generateAsset(env: Env, req: AssetReq): Promise<string> {
  const parts = [
    KIND_INSTRUCTIONS[req.kind],
    `Subject: ${req.subject}`,
    req.details ? `Details to use (only what's relevant): ${req.details}` : "",
    req.tone ? `Tone: ${req.tone}` : "",
    req.withHashtags ? "Include 2-4 relevant hashtags." : "Do not include hashtags.",
    "Output only the copy itself — no preamble, no explanation, no quotes around it.",
  ].filter(Boolean);
  return generateText(env, VOICE, parts.join("\n\n"));
}

/** Generate a microsite bio/tagline from sparse inputs. */
export async function generateBio(
  env: Env,
  name: string,
  facts: string,
): Promise<{ tagline: string; bio: string }> {
  const out = await generateText(
    env,
    VOICE,
    `Write a microsite tagline and bio for "${name}", a grassroots motorsports team/family.\n` +
      `Facts: ${facts}\n\n` +
      `Respond in exactly this format:\nTAGLINE: <one punchy line, max 8 words>\nBIO: <2-3 warm sentences>`,
  );
  const tagline = (out.match(/TAGLINE:\s*(.+)/i)?.[1] ?? "").trim();
  const bio = (out.match(/BIO:\s*([\s\S]+)/i)?.[1] ?? "").trim();
  return { tagline, bio };
}

/** Pull the first JSON array/object out of a model response (handles fences). */
function extractJson<T>(s: string, fallback: T): T {
  const fenced = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : s;
  const start = candidate.search(/[[{]/);
  if (start === -1) return fallback;
  // try progressively from the first bracket to the last matching close
  const sliced = candidate.slice(start);
  const lastClose = Math.max(sliced.lastIndexOf("]"), sliced.lastIndexOf("}"));
  if (lastClose === -1) return fallback;
  try {
    return JSON.parse(sliced.slice(0, lastClose + 1)) as T;
  } catch {
    return fallback;
  }
}

export interface ImportedRider {
  name: string;
  number?: string;
  race_class?: string;
  discipline?: string;
}
export interface ImportedEvent {
  title: string;
  date?: string; // ISO yyyy-mm-dd if the model can infer it
  track_name?: string;
  city?: string;
  state?: string;
  discipline?: string;
}

/**
 * AI-assisted import: turn pasted text (a schedule, a roster, a Facebook
 * event, a forwarded email) into structured riders + events. Best-effort —
 * the UI lets the user review/edit before anything is saved.
 */
export async function extractImport(
  env: Env,
  text: string,
): Promise<{ riders: ImportedRider[]; events: ImportedEvent[] }> {
  const clipped = text.slice(0, 6000);
  const sys =
    "You extract structured data from messy text about grassroots motorsports " +
    "(motocross, autocross, road racing, karting, etc.). Output STRICT JSON only — no prose.";
  const user =
    `From the text below, extract any RIDERS (people who race) and EVENTS (races/practices).\n` +
    `Return JSON exactly like:\n` +
    `{"riders":[{"name":"","number":"","race_class":"","discipline":""}],` +
    `"events":[{"title":"","date":"YYYY-MM-DD","track_name":"","city":"","state":"","discipline":""}]}\n` +
    `Rules: omit fields you can't determine. Use 2-letter state codes. If a year isn't given, assume the next occurrence. ` +
    `If there are no riders or no events, use an empty array. Output ONLY the JSON.\n\nTEXT:\n${clipped}`;
  const raw = await generateText(env, sys, user);
  const parsed = extractJson<{ riders?: ImportedRider[]; events?: ImportedEvent[] }>(raw, {});
  return {
    riders: Array.isArray(parsed.riders) ? parsed.riders.filter((r) => r && r.name).slice(0, 50) : [],
    events: Array.isArray(parsed.events) ? parsed.events.filter((e) => e && e.title).slice(0, 50) : [],
  };
}
