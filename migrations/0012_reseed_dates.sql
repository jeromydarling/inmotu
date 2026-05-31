-- inmotu — keep the demo/seed calendar alive: re-date seeded events to a
-- rolling near-future window relative to when this migration is applied, so the
-- Grid, Competition Map, and landing hero are always populated. Spreads seed
-- events ~3 days apart starting ~2 days out, preserving consistent
-- registration/end windows. Only touches source='seed' rows.

UPDATE events
SET starts_at = strftime('%s','now') + 86400 * (
      2 + 3 * (SELECT COUNT(*) FROM events e2 WHERE e2.source = 'seed' AND e2.rowid < events.rowid)
    )
WHERE source = 'seed';

UPDATE events
SET ends_at       = starts_at + 86400,
    reg_opens_at  = starts_at - 45 * 86400,
    reg_closes_at = starts_at - 4 * 86400
WHERE source = 'seed';
