// Small shared helpers for the Worker runtime.

export const now = () => Math.floor(Date.now() / 1000);

export const uid = (prefix = "") =>
  prefix + crypto.randomUUID().replace(/-/g, "");

const enc = new TextEncoder();

/** PBKDF2-SHA256 password hashing (WebCrypto — runs on the edge). */
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
    { name: "PBKDF2", salt, iterations: 120_000, hash: "SHA-256" },
    key,
    256,
  );
  return `pbkdf2$120000$${b64(salt)}$${b64(new Uint8Array(bits))}`;
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
