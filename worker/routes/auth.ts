import { Hono } from "hono";
import type { Env, Vars } from "../types";
import type { PublicUser } from "@shared/types";
import { toPublicUser, getUserById } from "../db";
import { hashPassword, verifyPassword, isEmail, now, uid, randomToken, sha256Hex } from "../lib/util";
import {
  createSession,
  destroySession,
  sessionCookie,
  clearCookie,
} from "../auth/session";
import { sendWelcome, sendVerifyEmail, sendPasswordReset } from "../lib/email";
import { rateLimit } from "../lib/budget";

// Mint a single-use, expiring token; store it HASHED, return the raw token.
async function mintToken(env: Env, userId: string, kind: "reset" | "verify", ttlSec: number): Promise<string> {
  const raw = randomToken();
  const hash = await sha256Hex(raw);
  const ts = now();
  // Invalidate prior unused tokens of this kind for the user.
  await env.DB.prepare("DELETE FROM auth_tokens WHERE user_id = ? AND kind = ? AND used_at IS NULL")
    .bind(userId, kind)
    .run();
  await env.DB.prepare(
    "INSERT INTO auth_tokens (id, user_id, kind, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)",
  )
    .bind(uid("tok_"), userId, kind, hash, ts + ttlSec, ts)
    .run();
  return raw;
}

const auth = new Hono<{ Bindings: Env; Variables: Vars }>();

const secure = (c: { env: Env }) => c.env.APP_ENV === "production";

auth.post("/register", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { email, password, full_name, home_region, zip } = body ?? {};

  if (!isEmail(email)) return c.json({ error: "Valid email required" }, 400);
  if (typeof password !== "string" || password.length < 8)
    return c.json({ error: "Password must be at least 8 characters" }, 400);
  if (typeof full_name !== "string" || !full_name.trim())
    return c.json({ error: "Name is required" }, 400);

  const existing = await c.env.DB.prepare("SELECT id FROM users WHERE email = ?")
    .bind(email.toLowerCase())
    .first();
  if (existing) return c.json({ error: "conflict", message: "Email already registered" }, 409);

  const id = uid("usr_");
  const ts = now();
  const hash = await hashPassword(password);
  const name = full_name.trim();
  const emailLc = email.toLowerCase();
  try {
    await c.env.DB.prepare(
      `INSERT INTO users (id, email, password_hash, full_name, home_region, zip, plan, role, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'free', 'member', ?, ?)`,
    )
      .bind(id, emailLc, hash, name, home_region ?? null, zip ?? null, ts, ts)
      .run();
  } catch {
    // UNIQUE(email) violation under a race → same 409 as the pre-check.
    return c.json({ error: "conflict", message: "Email already registered" }, 409);
  }

  const sid = await createSession(c.env, id);
  c.header("Set-Cookie", sessionCookie(sid, secure(c)));

  // Fire transactional emails without blocking the signup response. New users
  // start free, so they all get a verification nudge (paid users would skip,
  // but nobody registers paid). Welcome + verify go out best-effort.
  c.executionCtx.waitUntil(
    (async () => {
      try {
        await sendWelcome(c.env, emailLc, name);
        const token = await mintToken(c.env, id, "verify", 48 * 3600);
        await sendVerifyEmail(c.env, emailLc, token);
      } catch (e) {
        console.error("register: email send failed", e);
      }
    })(),
  );

  const user: PublicUser = {
    id,
    email: emailLc,
    full_name: name,
    home_region: home_region ?? null,
    zip: zip ?? null,
    plan: "free",
    role: "member",
    sectors: [],
    email_verified: false,
  };
  return c.json({ user }, 201);
});

auth.post("/login", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { email, password } = body ?? {};
  if (!isEmail(email) || typeof password !== "string")
    return c.json({ error: "Invalid credentials" }, 400);

  const row = await c.env.DB.prepare("SELECT * FROM users WHERE email = ?")
    .bind(email.toLowerCase())
    .first<Record<string, unknown>>();
  if (!row || !(await verifyPassword(password, row.password_hash as string)))
    return c.json({ error: "Invalid email or password" }, 401);

  const sid = await createSession(c.env, row.id as string);
  c.header("Set-Cookie", sessionCookie(sid, secure(c)));
  return c.json({ user: toPublicUser(row) });
});

auth.post("/logout", async (c) => {
  if (c.var.sessionId) await destroySession(c.env, c.var.sessionId);
  c.header("Set-Cookie", clearCookie(secure(c)));
  return c.json({ ok: true });
});

auth.get("/me", (c) => c.json({ user: c.var.user }));

// ── Password reset ───────────────────────────────────────────────────────────

// Request a reset link. Always returns success (never reveal whether an email
// is registered) and is rate-limited per IP+email to blunt enumeration/abuse.
auth.post("/forgot-password", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const email = typeof body?.email === "string" ? body.email.toLowerCase().trim() : "";
  if (!isEmail(email)) return c.json({ error: "Valid email required" }, 400);

  const ip = c.req.header("CF-Connecting-IP") ?? "anon";
  const ok = await rateLimit(c.env, `forgot:${ip}:${email}`, 5, 3600);
  if (!ok) return c.json({ ok: true }); // silently throttle; don't leak

  const row = await c.env.DB.prepare("SELECT id FROM users WHERE email = ?")
    .bind(email)
    .first<{ id: string }>();
  if (row) {
    c.executionCtx.waitUntil(
      (async () => {
        try {
          const token = await mintToken(c.env, row.id, "reset", 3600);
          await sendPasswordReset(c.env, email, token);
        } catch (e) {
          console.error("forgot-password: send failed", e);
        }
      })(),
    );
  }
  return c.json({ ok: true });
});

// Complete a reset: verify the token hash (unexpired + unused) → set new password.
auth.post("/reset-password", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const token = typeof body?.token === "string" ? body.token : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!token) return c.json({ error: "Missing token" }, 400);
  if (password.length < 8)
    return c.json({ error: "Password must be at least 8 characters" }, 400);

  const hash = await sha256Hex(token);
  const tok = await c.env.DB.prepare(
    "SELECT id, user_id, expires_at, used_at FROM auth_tokens WHERE token_hash = ? AND kind = 'reset'",
  )
    .bind(hash)
    .first<{ id: string; user_id: string; expires_at: number; used_at: number | null }>();
  if (!tok || tok.used_at || tok.expires_at < now())
    return c.json({ error: "This reset link is invalid or has expired." }, 400);

  const pw = await hashPassword(password);
  const ts = now();
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?").bind(pw, ts, tok.user_id),
    c.env.DB.prepare("UPDATE auth_tokens SET used_at = ? WHERE id = ?").bind(ts, tok.id),
  ]);

  // Log them in on success.
  const sid = await createSession(c.env, tok.user_id);
  c.header("Set-Cookie", sessionCookie(sid, secure(c)));
  const user = await getUserById(c.env, tok.user_id);
  return c.json({ ok: true, user });
});

// ── Email verification ───────────────────────────────────────────────────────

// Confirm an email from the link's token → set email_verified = 1.
auth.post("/verify", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const token = typeof body?.token === "string" ? body.token : "";
  if (!token) return c.json({ error: "Missing token" }, 400);

  const hash = await sha256Hex(token);
  const tok = await c.env.DB.prepare(
    "SELECT id, user_id, expires_at, used_at FROM auth_tokens WHERE token_hash = ? AND kind = 'verify'",
  )
    .bind(hash)
    .first<{ id: string; user_id: string; expires_at: number; used_at: number | null }>();
  if (!tok || tok.used_at || tok.expires_at < now())
    return c.json({ error: "This confirmation link is invalid or has expired." }, 400);

  const ts = now();
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE users SET email_verified = 1 WHERE id = ?").bind(tok.user_id),
    c.env.DB.prepare("UPDATE auth_tokens SET used_at = ? WHERE id = ?").bind(ts, tok.id),
  ]);
  const user = await getUserById(c.env, tok.user_id);
  return c.json({ ok: true, user });
});

// Re-send a verification email for the signed-in user (rate-limited).
auth.post("/resend-verification", async (c) => {
  const me = c.var.user;
  if (!me) return c.json({ error: "Not signed in" }, 401);
  if (me.email_verified) return c.json({ ok: true, already: true });

  const ok = await rateLimit(c.env, `resend-verify:${me.id}`, 3, 3600);
  if (!ok) return c.json({ error: "Please wait a bit before requesting another email." }, 429);

  const token = await mintToken(c.env, me.id, "verify", 48 * 3600);
  await sendVerifyEmail(c.env, me.email, token);
  return c.json({ ok: true });
});

export default auth;
