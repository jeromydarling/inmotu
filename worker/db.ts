import type { Env, Vars } from "./types";
import type { Context } from "hono";
import type { PublicUser } from "@shared/types";

export type AppContext = Context<{ Bindings: Env; Variables: Vars }>;

/** Map a users row to the public-safe shape. */
export function toPublicUser(row: Record<string, unknown>): PublicUser {
  return {
    id: row.id as string,
    email: row.email as string,
    full_name: row.full_name as string,
    home_region: (row.home_region as string) ?? null,
    zip: (row.zip as string) ?? null,
    plan: row.plan as PublicUser["plan"],
    role: row.role as PublicUser["role"],
  };
}

export async function getUserById(
  env: Env,
  id: string,
): Promise<PublicUser | null> {
  const row = await env.DB.prepare(
    "SELECT id, email, full_name, home_region, zip, plan, role FROM users WHERE id = ?",
  )
    .bind(id)
    .first<Record<string, unknown>>();
  return row ? toPublicUser(row) : null;
}
