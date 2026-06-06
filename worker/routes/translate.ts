import { Hono } from "hono";
import type { Env, Vars } from "../types";
import { rateLimit } from "../lib/budget";
import { translateBatch, isSupportedLang } from "../lib/translate";

// Public, on-demand content translation (Workers AI / Llama). Used by the
// "Ver en español" experience to translate dynamic content — rule and bill
// summaries, etc. Cached per string, so repeat reads are free.
const translate = new Hono<{ Bindings: Env; Variables: Vars }>();

const MAX_ITEMS = 100;
const MAX_CHARS = 8000; // total across the batch; keeps a single call bounded

translate.post("/", async (c) => {
  const b = await c.req.json().catch(() => ({}));
  const target = typeof b?.target === "string" ? b.target : "es";
  const texts: unknown = b?.texts;

  if (!isSupportedLang(target)) return c.json({ error: "Unsupported language" }, 400);
  if (!Array.isArray(texts) || texts.some((t) => typeof t !== "string"))
    return c.json({ error: "texts must be an array of strings" }, 400);
  if (texts.length === 0) return c.json({ translations: [] });
  if (texts.length > MAX_ITEMS) return c.json({ error: "Too many items" }, 400);

  const totalChars = (texts as string[]).reduce((n, t) => n + t.length, 0);
  if (totalChars > MAX_CHARS) return c.json({ error: "Batch too large" }, 400);

  // Coarse abuse guard — cache means real readers rarely hit the model anyway.
  const ip = c.req.header("CF-Connecting-IP") ?? "anon";
  if (!(await rateLimit(c.env, `translate:${ip}`, 60, 60)))
    return c.json({ error: "Slow down — try again in a moment." }, 429);

  const translations = await translateBatch(c.env, texts as string[], target);
  return c.json({ translations });
});

export default translate;
