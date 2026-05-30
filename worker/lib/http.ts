import type { Context } from "hono";
import type { Env, Vars } from "../types";

type Ctx = Context<{ Bindings: Env; Variables: Vars }>;

// Stable, machine-readable error codes for the API contract. Clients match on
// `error` (the code); `message` is the human-readable detail.
export type ErrCode =
  | "validation"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "billing_not_configured"
  | "internal";

const STATUS: Record<ErrCode, number> = {
  validation: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  billing_not_configured: 503,
  internal: 500,
};

export function err(c: Ctx, code: ErrCode, message?: string) {
  return c.json({ error: code, message }, STATUS[code] as 400);
}
