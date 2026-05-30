-- inmotu — operator comms, series/standings, sponsorship, rules, demo/leads

-- Mark demo accounts (form-gated demo) so we can seed + sandbox them.
ALTER TABLE users ADD COLUMN is_demo INTEGER NOT NULL DEFAULT 0;

-- ── Operator communication center ─────────────────────────────────────
CREATE TABLE announcements (
  id          TEXT PRIMARY KEY,
  event_id    TEXT REFERENCES events(id) ON DELETE CASCADE,
  operator_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  urgent      INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL
);
CREATE INDEX idx_ann_event ON announcements(event_id);
CREATE INDEX idx_ann_operator ON announcements(operator_id);

-- ── Series points & standings ─────────────────────────────────────────
CREATE TABLE series (
  id          TEXT PRIMARY KEY,
  slug        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  discipline  TEXT REFERENCES disciplines(slug),
  season      INTEGER NOT NULL,
  operator_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at  INTEGER NOT NULL
);
CREATE TABLE series_events (
  series_id TEXT NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  event_id  TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  PRIMARY KEY (series_id, event_id)
);
CREATE TABLE results (
  id          TEXT PRIMARY KEY,
  event_id    TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  competitor  TEXT NOT NULL,            -- name or rider number
  race_class  TEXT,
  position    INTEGER NOT NULL,
  points      INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL
);
CREATE INDEX idx_results_event ON results(event_id);

-- ── Sponsorship management ────────────────────────────────────────────
CREATE TABLE sponsors (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  tier         TEXT,                    -- title | associate | contingency
  amount_cents INTEGER,
  deliverables TEXT,                    -- json array of {text, done}
  renewal_at   INTEGER,
  status       TEXT NOT NULL DEFAULT 'active'
                 CHECK (status IN ('prospect','active','expired')),
  created_at   INTEGER NOT NULL
);
CREATE INDEX idx_sponsors_user ON sponsors(user_id);

-- ── Rules library ─────────────────────────────────────────────────────
CREATE TABLE rules_docs (
  id          TEXT PRIMARY KEY,
  discipline  TEXT,
  body_slug   TEXT,
  category    TEXT NOT NULL,            -- classes | advancement | safety | conduct
  title       TEXT NOT NULL,
  summary     TEXT NOT NULL,
  url         TEXT,
  season      INTEGER
);
CREATE INDEX idx_rules_discipline ON rules_docs(discipline);
CREATE INDEX idx_rules_category ON rules_docs(category);

-- ── Demo lead capture ─────────────────────────────────────────────────
CREATE TABLE leads (
  id         TEXT PRIMARY KEY,
  name       TEXT,
  email      TEXT NOT NULL,
  role       TEXT,                      -- parent | racer | operator | other
  user_id    TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_leads_email ON leads(email);
