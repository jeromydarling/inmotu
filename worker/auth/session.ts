import type { Env } from "../types";
import { uid } from "../lib/util";

const SESSION_TTL = 60 * 60 * 24 * 30; // 30 days
export const COOKIE = "imt_session";

interface SessionData {
  userId: string;
  createdAt: number;
}

export async function createSession(
  env: Env,
  userId: string,
): Promise<string> {
  const id = uid("sess_");
  const data: SessionData = { userId, createdAt: Date.now() };
  await env.SESSIONS.put(id, JSON.stringify(data), {
    expirationTtl: SESSION_TTL,
  });
  return id;
}

export async function getSession(
  env: Env,
  id: string,
): Promise<SessionData | null> {
  const raw = await env.SESSIONS.get(id);
  return raw ? (JSON.parse(raw) as SessionData) : null;
}

export async function destroySession(env: Env, id: string): Promise<void> {
  await env.SESSIONS.delete(id);
}

export function sessionCookie(id: string, secure: boolean): string {
  const attrs = [
    `${COOKIE}=${id}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${SESSION_TTL}`,
  ];
  if (secure) attrs.push("Secure");
  return attrs.join("; ");
}

export function clearCookie(secure: boolean): string {
  const attrs = [`${COOKIE}=`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];
  if (secure) attrs.push("Secure");
  return attrs.join("; ");
}

export function readCookie(header: string | null): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === COOKIE) return v.join("=");
  }
  return null;
}
