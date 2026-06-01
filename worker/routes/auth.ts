import { Hono } from "hono";
import type { Env, Vars } from "../types";
import type { PublicUser } from "@shared/types";
import { toPublicUser } from "../db";
import { hashPassword, verifyPassword, isEmail, now, uid } from "../lib/util";
import {
  createSession,
  destroySession,
  sessionCookie,
  clearCookie,
} from "../auth/session";

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
  const user: PublicUser = {
    id,
    email: emailLc,
    full_name: name,
    home_region: home_region ?? null,
    zip: zip ?? null,
    plan: "free",
    role: "member",
    sectors: [],
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

// TEMP DIAGNOSTIC (mobile-friendly): walks each signup step and reports exactly
// which one fails, as plain text. Uses a throwaway user and cleans up. Remove
// once the prod signup 500 is fixed. Open in a browser: /api/auth/_diag
auth.get("/_diag", async (c) => {
  const lines: string[] = [];
  const step = (s: string) => lines.push(s);
  const testId = "usr_diag_" + uid().slice(0, 8);
  const testEmail = `diag_${Date.now()}@inmotu-diag.invalid`;
  try {
    step("1. hashPassword…");
    const hash = await hashPassword("racing2026");
    step("   ok (len " + hash.length + ")");

    step("2. INSERT users…");
    await c.env.DB.prepare(
      `INSERT INTO users (id, email, password_hash, full_name, home_region, zip, plan, role, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'free', 'member', ?, ?)`,
    )
      .bind(testId, testEmail, hash, "Diag", null, null, now(), now())
      .run();
    step("   ok");

    step("3. createSession (KV put)…");
    const sid = await createSession(c.env, testId);
    step("   ok (" + sid.slice(0, 12) + "…)");

    step("4. read back (getUserById SELECT)…");
    const me = await c.env.DB.prepare(
      "SELECT id, email, full_name, home_region, zip, plan, role, sectors FROM users WHERE id = ?",
    )
      .bind(testId)
      .first();
    step("   ok: " + JSON.stringify(me));

    step("5. cleanup…");
    await destroySession(c.env, sid);
    await c.env.DB.prepare("DELETE FROM users WHERE id = ?").bind(testId).run();
    step("   ok");
    step("");
    step("RESULT: all steps passed — signup path is healthy.");
  } catch (e) {
    step("");
    step("FAILED at the step above.");
    step("ERROR: " + String((e as Error)?.message ?? e));
    step("STACK: " + String((e as Error)?.stack ?? "").split("\n").slice(0, 3).join(" | "));
    // best-effort cleanup
    try { await c.env.DB.prepare("DELETE FROM users WHERE id = ?").bind(testId).run(); } catch { /* ignore */ }
  }
  return c.text(lines.join("\n"));
});

export default auth;
