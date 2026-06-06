import type { Env } from "../types";

export interface PurgeResult {
  user: boolean; // was the user row deleted?
  deleted: Record<string, number>; // child rows removed, per table
}

/**
 * Delete a user and ALL of their child rows. Built for the e2e test rig so CI
 * runs don't accumulate junk accounts. The cascade is discovered dynamically:
 * any table with a `user_id` column is cleared for this user, and any table
 * with a `rider_id` column is cleared for the user's riders — so it stays
 * correct as the schema grows, with no hand-maintained table list.
 *
 * The calling route restricts this to disposable e2e+ test emails, so even a
 * leaked token can never delete a real account.
 */
export async function purgeUserByEmail(env: Env, email: string): Promise<PurgeResult | null> {
  const row = await env.DB.prepare("SELECT id FROM users WHERE email = ?")
    .bind(email.toLowerCase())
    .first<{ id: string }>();
  if (!row) return null;
  const userId = row.id;
  const deleted: Record<string, number> = {};

  // Every app table (skip SQLite internals, Cloudflare metadata, and users).
  const tablesRes = await env.DB.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name <> 'users'",
  ).all<{ name: string }>();
  const tables = (tablesRes.results ?? []).map((t) => t.name);

  // The user's riders — so rider-keyed grandchildren (ladder progress, scores,
  // results) get cleared before we remove the riders themselves.
  const ridersRes = await env.DB.prepare("SELECT id FROM riders WHERE user_id = ?")
    .bind(userId)
    .all<{ id: string }>();
  const riderIds = (ridersRes.results ?? []).map((r) => r.id);

  // Classify each table by which key it carries.
  const userTables: string[] = [];
  const riderTables: string[] = [];
  for (const t of tables) {
    const colsRes = await env.DB.prepare(`SELECT name FROM pragma_table_info('${t}')`).all<{ name: string }>();
    const cols = (colsRes.results ?? []).map((c) => c.name);
    if (cols.includes("user_id")) userTables.push(t);
    else if (cols.includes("rider_id")) riderTables.push(t);
  }

  // Grandchildren (rider-keyed) first, then user-keyed, then the user row —
  // an order that satisfies foreign keys if D1 enforces them.
  if (riderIds.length) {
    const placeholders = riderIds.map(() => "?").join(",");
    for (const t of riderTables) {
      try {
        const r = await env.DB.prepare(`DELETE FROM ${t} WHERE rider_id IN (${placeholders})`)
          .bind(...riderIds)
          .run();
        deleted[t] = (r.meta?.changes as number) ?? 0;
      } catch (e) {
        console.error("purge: rider table", t, e);
      }
    }
  }
  for (const t of userTables) {
    try {
      const r = await env.DB.prepare(`DELETE FROM ${t} WHERE user_id = ?`).bind(userId).run();
      deleted[t] = (r.meta?.changes as number) ?? 0;
    } catch (e) {
      console.error("purge: user table", t, e);
    }
  }
  const ur = await env.DB.prepare("DELETE FROM users WHERE id = ?").bind(userId).run();
  return { user: ((ur.meta?.changes as number) ?? 0) > 0, deleted };
}
