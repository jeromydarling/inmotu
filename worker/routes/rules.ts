import { Hono } from "hono";
import type { Env, Vars } from "../types";

// Rules library — public reference (classes, advancement, safety, conduct).
const rules = new Hono<{ Bindings: Env; Variables: Vars }>();

rules.get("/", async (c) => {
  const { discipline, category, q } = c.req.query();
  const where: string[] = [];
  const binds: unknown[] = [];
  if (discipline) (where.push("(discipline = ? OR discipline = '' OR discipline IS NULL)"), binds.push(discipline));
  if (category) (where.push("category = ?"), binds.push(category));
  if (q) (where.push("(title LIKE ? OR summary LIKE ?)"), binds.push(`%${q}%`, `%${q}%`));
  const { results } = await c.env.DB.prepare(
    `SELECT * FROM rules_docs ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY category, title`,
  )
    .bind(...binds)
    .all();
  return c.json({ rules: results });
});

export default rules;
