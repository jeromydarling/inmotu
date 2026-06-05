import type { Env } from "../types";
import { now, sha256Hex, parseJson } from "./util";

// AI translation via Workers AI (Llama 3.3). Batched (one model call for many
// strings) and cached per-string in the ai_cache table, so the same rule or
// bill summary is only ever translated once per language. Workers AI is included
// (Neurons), so the only guard needed is a per-IP rate limit at the route.

const TEXT_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

// Human-readable target names sharpen Llama's output. "es" is our only language
// today, but the map keeps adding more a one-line change.
const LANG_NAMES: Record<string, string> = {
  es: "Spanish (neutral Latin American)",
};

export function isSupportedLang(t: string): boolean {
  return t in LANG_NAMES;
}

const cacheKey = (target: string, hash: string) => `tr:${target}:${hash}`;

/** Pull a JSON array out of a model response (handles ``` fences + stray prose). */
function extractArray(s: string): string[] | null {
  const fenced = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : s;
  const start = body.indexOf("[");
  const end = body.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) return null;
  try {
    const arr = JSON.parse(body.slice(start, end + 1));
    return Array.isArray(arr) ? arr.map((x) => String(x)) : null;
  } catch {
    return null;
  }
}

/**
 * Translate a batch of strings into `target`. Returns an array the same length
 * and order as the input. Cache hits skip the model; only the misses are sent.
 * On any model/parse failure the original text is returned (never throws).
 */
export async function translateBatch(
  env: Env,
  texts: string[],
  target: string,
): Promise<string[]> {
  if (!isSupportedLang(target)) return texts;

  // De-dupe to one entry per distinct, non-empty string.
  const distinct = [...new Set(texts.map((t) => (t ?? "").trim()).filter(Boolean))];
  if (distinct.length === 0) return texts;

  const hashes = await Promise.all(distinct.map((t) => sha256Hex(`${target}:${t}`)));
  const out = new Map<string, string>(); // original → translated

  // 1) Read cache.
  const misses: { text: string; hash: string }[] = [];
  await Promise.all(
    distinct.map(async (text, i) => {
      const hash = hashes[i];
      const row = await env.DB.prepare("SELECT payload FROM ai_cache WHERE key = ?")
        .bind(cacheKey(target, hash))
        .first<{ payload: string }>();
      if (row) out.set(text, parseJson<string>(row.payload, text));
      else misses.push({ text, hash });
    }),
  );

  // 2) Translate the misses in one model call.
  if (misses.length > 0) {
    const langName = LANG_NAMES[target];
    const sys =
      `You are a professional translator. Translate each string in the user's JSON ` +
      `array into ${langName}. Preserve meaning, tone, proper nouns, numbers, and any ` +
      `inline formatting. Keep racing/motorsport terms natural for that audience. ` +
      `Return ONLY a JSON array of translated strings — same length and order, no commentary.`;
    try {
      const res = (await env.AI.run(TEXT_MODEL, {
        messages: [
          { role: "system", content: sys },
          { role: "user", content: JSON.stringify(misses.map((m) => m.text)) },
        ],
        max_tokens: 4000,
        temperature: 0.2,
      })) as { response?: string };
      const arr = extractArray(res.response ?? "");
      const ts = now();
      if (arr && arr.length === misses.length) {
        await Promise.all(
          misses.map(async (m, i) => {
            const tr = arr[i] || m.text;
            out.set(m.text, tr);
            await env.DB.prepare(
              "INSERT OR REPLACE INTO ai_cache (key, payload, refreshed_at) VALUES (?, ?, ?)",
            )
              .bind(cacheKey(target, m.hash), JSON.stringify(tr), ts)
              .run();
          }),
        );
      } else {
        // Length mismatch / parse fail → leave misses as their originals.
        for (const m of misses) out.set(m.text, m.text);
      }
    } catch (e) {
      console.error("translateBatch failed", e);
      for (const m of misses) out.set(m.text, m.text);
    }
  }

  // 3) Reassemble in the caller's original order (empty stays empty).
  return texts.map((t) => {
    const key = (t ?? "").trim();
    return key ? out.get(key) ?? t : t;
  });
}
