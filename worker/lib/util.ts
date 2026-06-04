// Small shared helpers for the Worker runtime.

export const now = () => Math.floor(Date.now() / 1000);

export const uid = (prefix = "") =>
  prefix + crypto.randomUUID().replace(/-/g, "");

/** A URL-safe random token (for password reset / email verification links). */
export function randomToken(bytes = 32): string {
  const a = crypto.getRandomValues(new Uint8Array(bytes));
  let s = "";
  for (const b of a) s += b.toString(16).padStart(2, "0");
  return s;
}

/** SHA-256 hex of a string (used to store tokens hashed, never raw). */
export async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const enc = new TextEncoder();

/** PBKDF2-SHA256 password hashing (WebCrypto — runs on the edge).
 * Cloudflare Workers caps PBKDF2 at 100,000 iterations (real runtime enforces
 * this even though Miniflare/local does not). The iteration count is embedded
 * in the stored hash so verifyPassword stays compatible with any stored value. */
const PBKDF2_ITERATIONS = 100_000;

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    key,
    256,
  );
  return `pbkdf2$${PBKDF2_ITERATIONS}$${b64(salt)}$${b64(new Uint8Array(bits))}`;
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const [scheme, iterStr, saltB64, hashB64] = stored.split("$");
  if (scheme !== "pbkdf2") return false;
  const salt = unb64(saltB64);
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: Number(iterStr), hash: "SHA-256" },
    key,
    256,
  );
  return timingSafeEqual(b64(new Uint8Array(bits)), hashB64);
}

function b64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
function unb64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function isEmail(v: unknown): v is string {
  return typeof v === "string" && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v);
}

/**
 * Single slugify used everywhere. `unique:true` appends a short uid-derived
 * (crypto-random) suffix for collision-free, non-deterministic slugs; omit it
 * for deterministic slugs (e.g. idempotent feed ingestion).
 */
export function slugify(s: string, opts: { maxLen?: number; unique?: boolean } = {}): string {
  const { maxLen = 60, unique = false } = opts;
  const base = s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, maxLen);
  return unique ? `${base}-${uid().slice(0, 6)}` : base;
}

/** Safe JSON parse with a typed fallback (never throws). */
export function parseJson<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}
