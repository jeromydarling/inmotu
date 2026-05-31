-- inmotu — local crews/clubs discovery. The data nobody's captured: every local
-- club, team, series, track program, and community group, per sector + region.
-- AI-discovered (Perplexity), ORGS ONLY (no individuals), and verify-gated —
-- nothing with contact info is shown as authoritative until reviewed. Every row
-- carries its citation so a family can tap through and confirm.

CREATE TABLE crews (
  id          TEXT PRIMARY KEY,
  sector      TEXT NOT NULL,                 -- SectorId
  name        TEXT NOT NULL,
  kind        TEXT NOT NULL DEFAULT 'club',  -- club | team | series | track_program | group
  blurb       TEXT,                          -- one line: who they are / who they welcome
  city        TEXT,
  state       TEXT,                          -- 2-letter
  -- public ORG contact info only (never individuals); any of these may be null
  website     TEXT,
  email       TEXT,
  phone       TEXT,
  facebook    TEXT,
  meets       TEXT,                          -- e.g. "Race nights Thu/Sat, Apr–Oct"
  beginner_friendly INTEGER NOT NULL DEFAULT 0,
  -- provenance + trust
  source      TEXT NOT NULL DEFAULT 'perplexity',
  citations   TEXT,                          -- json [{title,url}]
  needs_review INTEGER NOT NULL DEFAULT 1,   -- verify-gated: 1 until a human confirms
  verified    INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL,
  refreshed_at INTEGER NOT NULL,
  -- dedupe the same org within a sector+state
  UNIQUE(sector, state, name)
);

CREATE INDEX idx_crews_sector_state ON crews(sector, state);
CREATE INDEX idx_crews_review ON crews(needs_review);
