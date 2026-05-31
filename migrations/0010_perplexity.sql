-- inmotu — Perplexity/Civic integration: cache + provenance

-- AI-sourced legislation gets provenance + citations; cron refreshes daily.
ALTER TABLE legislation ADD COLUMN source TEXT NOT NULL DEFAULT 'seed';   -- seed | perplexity
ALTER TABLE legislation ADD COLUMN citations TEXT;                        -- json [{title,url}]
ALTER TABLE legislation ADD COLUMN ai_summary TEXT;                       -- web-grounded summary
ALTER TABLE legislation ADD COLUMN refreshed_at INTEGER;

-- AI-discovered events are flagged until verified (never shown as authoritative).
ALTER TABLE events ADD COLUMN needs_review INTEGER NOT NULL DEFAULT 0;

-- Cache for legislator lookups by ZIP (Civic API) to avoid repeat calls.
CREATE TABLE legislator_cache (
  zip        TEXT PRIMARY KEY,
  state      TEXT,
  payload    TEXT NOT NULL,           -- json of officials
  refreshed_at INTEGER NOT NULL
);

-- Generic KV-ish cache table for Perplexity responses (state legislation, etc).
CREATE TABLE ai_cache (
  key        TEXT PRIMARY KEY,        -- e.g. 'legis:MN', 'events:north-central'
  payload    TEXT NOT NULL,
  refreshed_at INTEGER NOT NULL
);
