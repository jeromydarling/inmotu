import type { MiddlewareHandler } from "hono";
import type { Env, Vars } from "../types";
import { getSession, readCookie } from "./session";
import { getUserById } from "../db";

/** Populates ctx.var.user / ctx.var.sessionId when a valid session exists. */
export const sessionMiddleware: MiddlewareHandler<{
  Bindings: Env;
  Variables: Vars;
}> = async (c, next) => {
  c.set("user", null);
  c.set("sessionId", null);
  const id = readCookie(c.req.header("Cookie") ?? null);
  if (id) {
    const sess = await getSession(c.env, id);
    if (sess) {
      const user = await getUserById(c.env, sess.userId);
      if (user) {
        c.set("user", user);
        c.set("sessionId", id);
      }
    }
  }
  await next();
};

/** Guards routes that require a signed-in user. */
export const requireAuth: MiddlewareHandler<{
  Bindings: Env;
  Variables: Vars;
}> = async (c, next) => {
  if (!c.var.user) return c.json({ error: "unauthorized", message: "Authentication required" }, 401);
  await next();
};

/** Guards routes that require a specific role (e.g. "admin"). */
export const requireRole =
  (role: "operator" | "admin"): MiddlewareHandler<{ Bindings: Env; Variables: Vars }> =>
  async (c, next) => {
    if (!c.var.user) return c.json({ error: "unauthorized" }, 401);
    if (c.var.user.role !== role) return c.json({ error: "forbidden", message: `${role} only` }, 403);
    await next();
  };
