import type { MiddlewareHandler } from "hono";
import type { Env, Vars } from "../types";
import type { Plan } from "@shared/types";

// Plan hierarchy — each tier includes everything below it. Tower (operators)
// is the superset; an operator may also be a racing parent.
export const PLAN_RANK: Record<Plan, number> = { free: 0, family: 1, pro: 2, tower: 3 };

// Minimum plan required for each gated feature area (matches the pricing page).
export const FEATURE_MIN = {
  ladder: "family",
  budget: "family",
  maintenance: "family",
  photos: "family",
  garage: "pro",
  sponsors: "pro",
  tower: "tower",
} as const satisfies Record<string, Plan>;

export type Feature = keyof typeof FEATURE_MIN;

export const FREE_RIDER_LIMIT = 1;

export function planMeets(plan: Plan, min: Plan): boolean {
  return PLAN_RANK[plan] >= PLAN_RANK[min];
}

/** Guards a route behind a minimum plan; returns 402 upgrade_required if short. */
export const requirePlan =
  (feature: Feature): MiddlewareHandler<{ Bindings: Env; Variables: Vars }> =>
  async (c, next) => {
    if (!c.var.user) return c.json({ error: "unauthorized" }, 401);
    const min = FEATURE_MIN[feature];
    if (!planMeets(c.var.user.plan, min)) {
      return c.json(
        { error: "upgrade_required", message: `This feature is part of the ${min} plan.`, plan: min },
        402,
      );
    }
    await next();
  };
