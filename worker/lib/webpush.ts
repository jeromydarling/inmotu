import type { Env } from "../types";

// Minimal Web Push (RFC 8291 aes128gcm + RFC 8292 VAPID) using WebCrypto.
// Keys are base64url. Sends a single notification to one subscription.

export interface PushSub {
  endpoint: string;
  p256dh: string; // base64url
  auth: string; // base64url
}

const b64urlToBytes = (s: string): Uint8Array => {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

const bytesToB64url = (b: Uint8Array): string => {
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

// Clean ArrayBuffer view (WebCrypto wants ArrayBuffer, not a Uint8Array view).
const ab = (u: Uint8Array): ArrayBuffer =>
  u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength) as ArrayBuffer;

const concat = (...arrs: Uint8Array[]): Uint8Array => {
  const len = arrs.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(len);
  let off = 0;
  for (const a of arrs) {
    out.set(a, off);
    off += a.length;
  }
  return out;
};

async function hmac(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey(
    "raw",
    ab(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, ab(data)));
}

// Build the ES256 VAPID JWT for the Authorization header.
async function vapidAuth(env: Env, audience: string): Promise<string | null> {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return null;
  const header = { typ: "JWT", alg: "ES256" };
  const payload = {
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: env.EMAIL_FROM ? `mailto:${env.EMAIL_FROM}` : "mailto:admin@inmotu.pro",
  };
  const enc = (o: unknown) => bytesToB64url(new TextEncoder().encode(JSON.stringify(o)));
  const signingInput = `${enc(header)}.${enc(payload)}`;

  // Import the raw private key (d) into a P-256 ECDSA key via JWK.
  const pub = b64urlToBytes(env.VAPID_PUBLIC_KEY); // 65 bytes: 0x04 + x(32) + y(32)
  const jwk: JsonWebKey = {
    kty: "EC",
    crv: "P-256",
    x: bytesToB64url(pub.slice(1, 33)),
    y: bytesToB64url(pub.slice(33, 65)),
    d: env.VAPID_PRIVATE_KEY,
    ext: true,
  };
  const importJwk = (crypto.subtle as unknown as {
    importKey: (...a: unknown[]) => Promise<CryptoKey>;
  }).importKey;
  const key = await importJwk("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const sig = new Uint8Array(
    await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      ab(new TextEncoder().encode(signingInput)),
    ),
  );
  return `${signingInput}.${bytesToB64url(sig)}`;
}

/**
 * Encrypt + POST a push message. Returns the HTTP status (201 = delivered,
 * 404/410 = subscription gone → caller should delete it). Returns 0 if push
 * isn't configured.
 */
export async function sendPush(env: Env, sub: PushSub, payload: string): Promise<number> {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return 0;

  const plaintext = new TextEncoder().encode(payload);
  const ua = b64urlToBytes(sub.p256dh); // client public key (65 bytes)
  const authSecret = b64urlToBytes(sub.auth); // 16 bytes
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // WebCrypto ECDH: the Workers type defs are incomplete for these calls
  // (raw EC import + ECDH deriveBits/exportKey), so we use a loosely-typed
  // handle. This is standard, runtime-correct WebCrypto.
  const subtle = crypto.subtle as unknown as {
    importKey: (...a: unknown[]) => Promise<CryptoKey>;
    deriveBits: (...a: unknown[]) => Promise<ArrayBuffer>;
    exportKey: (...a: unknown[]) => Promise<ArrayBuffer>;
    generateKey: (...a: unknown[]) => Promise<CryptoKeyPair>;
  };

  // Ephemeral server ECDH key pair.
  const asKeys = await subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const asPublicRaw = new Uint8Array(await subtle.exportKey("raw", asKeys.publicKey)); // 65 bytes

  const uaKey = await subtle.importKey("raw", ab(ua), { name: "ECDH", namedCurve: "P-256" }, false, []);
  const ecdh = new Uint8Array(
    await subtle.deriveBits({ name: "ECDH", public: uaKey }, asKeys.privateKey, 256),
  );

  // RFC 8291 key derivation (aes128gcm).
  const prkKey = await hmac(authSecret, ecdh);
  const keyInfo = concat(
    new TextEncoder().encode("WebPush: info\0"),
    ua,
    asPublicRaw,
  );
  const ikm = await hmac(prkKey, concat(keyInfo, new Uint8Array([1])));

  const prk = await hmac(salt, ikm);
  const cekInfo = new TextEncoder().encode("Content-Encoding: aes128gcm\0");
  const cek = (await hmac(prk, concat(cekInfo, new Uint8Array([1])))).slice(0, 16);
  const nonceInfo = new TextEncoder().encode("Content-Encoding: nonce\0");
  const nonce = (await hmac(prk, concat(nonceInfo, new Uint8Array([1])))).slice(0, 12);

  // Body = header block + aes128gcm(plaintext + 0x02 padding delimiter).
  const aesKey = await crypto.subtle.importKey("raw", ab(cek), { name: "AES-GCM" }, false, ["encrypt"]);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: ab(nonce) },
      aesKey,
      ab(concat(plaintext, new Uint8Array([2]))),
    ),
  );

  const recordSize = new Uint8Array(4);
  new DataView(recordSize.buffer).setUint32(0, 4096);
  const header = concat(salt, recordSize, new Uint8Array([asPublicRaw.length]), asPublicRaw);
  const body = concat(header, ciphertext);

  const audience = new URL(sub.endpoint).origin;
  const jwt = await vapidAuth(env, audience);
  if (!jwt) return 0;

  const res = await fetch(sub.endpoint, {
    method: "POST",
    headers: {
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: "86400",
      Authorization: `vapid t=${jwt}, k=${env.VAPID_PUBLIC_KEY}`,
    },
    body,
  });
  return res.status;
}
