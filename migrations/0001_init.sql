-- inmotu — core schema (D1 / SQLite)
-- Single user identity feeds all five modules: Grid, Pit Board, Tower,
-- Garage, Frontline. Designed for edge reads with covering indexes.

-- ──────────────────────────────────────────────────────────────────────
-- Identity & accounts
-- ──────────────────────────────────────────────────────────────────────
CREATE TABLE users (
  id            TEXT PRIMARY KEY,            -- uuid
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,               -- PBKDF2 (WebCrypto)
  full_name     TEXT NOT NULL,
  home_region   TEXT,                        -- e.g. 'AMA-Area-22', state code
  zip           TEXT,
  plan          TEXT NOT NULL DEFAULT 'free' -- free | family | pro | tower
                  CHECK (plan IN ('free','family','pro','tower')),
  stripe_customer_id TEXT,
  role          TEXT NOT NULL DEFAULT 'member'
                  CHECK (role IN ('member','operator','admin')),
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL
);
CREATE INDEX idx_users_stripe ON users(stripe_customer_id);

-- ──────────────────────────────────────────────────────────────────────
-- Disciplines, tracks, sanctioning bodies (reference data)
-- ──────────────────────────────────────────────────────────────────────
CREATE TABLE disciplines (
  slug  TEXT PRIMARY KEY,                    -- 'motocross','autocross','road-race'...
  label TEXT NOT NULL,
  kind  TEXT NOT NULL CHECK (kind IN ('moto','car'))
);

CREATE TABLE sanctioning_bodies (
  slug  TEXT PRIMARY KEY,                    -- 'ama','scca','nasa','champcar'
  label TEXT NOT NULL,
  url   TEXT
);

CREATE TABLE tracks (
  id          TEXT PRIMARY KEY,
  slug        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  discipline  TEXT REFERENCES disciplines(slug),
  surface     TEXT,                          -- 'dirt','asphalt','mixed'
  city        TEXT,
  state       TEXT,                          -- 2-letter
  lat         REAL,
  lng         REAL,
  amenities   TEXT,                          -- json array
  website     TEXT,
  status      TEXT NOT NULL DEFAULT 'active'
                CHECK (status IN ('active','endangered','closed')),
  created_at  INTEGER NOT NULL
);
CREATE INDEX idx_tracks_state ON tracks(state);
CREATE INDEX idx_tracks_discipline ON tracks(discipline);
CREATE INDEX idx_tracks_status ON tracks(status);

-- ──────────────────────────────────────────────────────────────────────
-- Module 1: The Grid — events
-- ──────────────────────────────────────────────────────────────────────
CREATE TABLE events (
  id            TEXT PRIMARY KEY,
  slug          TEXT NOT NULL UNIQUE,
  title         TEXT NOT NULL,
  discipline    TEXT REFERENCES disciplines(slug),
  body_slug     TEXT REFERENCES sanctioning_bodies(slug),
  track_id      TEXT REFERENCES tracks(id),
  region        TEXT,                        -- AMA area / SCCA region / state
  level         TEXT,                        -- 'beginner','club','qualifier','regional','national'
  age_group     TEXT,                        -- 'youth','amateur','all'
  starts_at     INTEGER NOT NULL,            -- epoch seconds (event day)
  ends_at       INTEGER,
  reg_opens_at  INTEGER,
  reg_closes_at INTEGER,                     -- the critical deadline
  entry_fee_cents   INTEGER,
  gate_fee_cents    INTEGER,
  external_url  TEXT,                         -- source registration link
  source        TEXT NOT NULL DEFAULT 'manual', -- 'mxsports','motorsportreg','manual'
  ladder_id     TEXT,                          -- links to qualifying ladder stage
  created_at    INTEGER NOT NULL
);
CREATE INDEX idx_events_starts ON events(starts_at);
CREATE INDEX idx_events_discipline_starts ON events(discipline, starts_at);
CREATE INDEX idx_events_region ON events(region);
CREATE INDEX idx_events_track ON events(track_id);

-- Saved / followed events per user (calendar sync source of truth)
CREATE TABLE saved_events (
  user_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id  TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  reminder  INTEGER NOT NULL DEFAULT 1,      -- send deadline alert?
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, event_id)
);

-- Road to Loretta's style qualifying ladders
CREATE TABLE ladders (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,                 -- 'Road to Loretta Lynn 2026'
  discipline  TEXT REFERENCES disciplines(slug),
  season      INTEGER NOT NULL
);
CREATE TABLE ladder_stages (
  id        TEXT PRIMARY KEY,
  ladder_id TEXT NOT NULL REFERENCES ladders(id) ON DELETE CASCADE,
  name      TEXT NOT NULL,                   -- 'Area Qualifier','Regional','National'
  stage_order INTEGER NOT NULL,
  region    TEXT                             -- one of 8 geographic regions
);

-- ──────────────────────────────────────────────────────────────────────
-- Module 2: The Pit Board — families, riders, progress
-- ──────────────────────────────────────────────────────────────────────
CREATE TABLE riders (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- family owner
  name         TEXT NOT NULL,
  birthdate    TEXT,                          -- iso date, drives class eligibility
  discipline   TEXT REFERENCES disciplines(slug),
  race_class    TEXT,                         -- e.g. '85cc (10-12)', 'Spec Miata'
  number        TEXT,                         -- race number
  ama_license   TEXT,
  skill_level   TEXT DEFAULT 'novice',
  created_at    INTEGER NOT NULL
);
CREATE INDEX idx_riders_user ON riders(user_id);

-- A rider's progress through a qualifying ladder
CREATE TABLE rider_ladder_progress (
  id         TEXT PRIMARY KEY,
  rider_id   TEXT NOT NULL REFERENCES riders(id) ON DELETE CASCADE,
  stage_id   TEXT NOT NULL REFERENCES ladder_stages(id) ON DELETE CASCADE,
  event_id   TEXT REFERENCES events(id),
  result_pos INTEGER,                         -- finishing position
  advanced   INTEGER NOT NULL DEFAULT 0,      -- did they qualify onward?
  recorded_at INTEGER NOT NULL,
  UNIQUE (rider_id, stage_id)
);

-- Maintenance logs (bike/car service)
CREATE TABLE maintenance_logs (
  id         TEXT PRIMARY KEY,
  rider_id   TEXT NOT NULL REFERENCES riders(id) ON DELETE CASCADE,
  performed_at INTEGER NOT NULL,
  hours      REAL,                            -- engine hours
  item       TEXT NOT NULL,                   -- 'top end','oil','chain'
  notes      TEXT,
  cost_cents INTEGER
);
CREATE INDEX idx_maint_rider ON maintenance_logs(rider_id);

-- Season budget tracker
CREATE TABLE budget_entries (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rider_id   TEXT REFERENCES riders(id) ON DELETE SET NULL,
  category   TEXT NOT NULL,                   -- 'entry','travel','maintenance','gear'
  amount_cents INTEGER NOT NULL,
  spent_at   INTEGER NOT NULL,
  note       TEXT
);
CREATE INDEX idx_budget_user ON budget_entries(user_id, spent_at);

-- ──────────────────────────────────────────────────────────────────────
-- Module 5: The Frontline — advocacy
-- ──────────────────────────────────────────────────────────────────────
CREATE TABLE legislation (
  id          TEXT PRIMARY KEY,
  state       TEXT NOT NULL,                  -- 2-letter
  state_name  TEXT NOT NULL,
  bill_number TEXT,                           -- 'HB 926'
  title       TEXT NOT NULL,
  summary     TEXT,
  status      TEXT NOT NULL                   -- 'introduced','committee','passed','enacted','failed'
                CHECK (status IN ('introduced','committee','passed','enacted','failed')),
  url         TEXT,
  updated_at  INTEGER NOT NULL
);
CREATE INDEX idx_legislation_state ON legislation(state);
CREATE INDEX idx_legislation_status ON legislation(status);

-- Crowdsourced endangered-track reports
CREATE TABLE track_threats (
  id         TEXT PRIMARY KEY,
  track_id   TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  reported_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  threat_type TEXT NOT NULL,                  -- 'zoning','nuisance','development','litigation'
  description TEXT,
  verified    INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL
);
CREATE INDEX idx_threats_track ON track_threats(track_id);

-- A user pledging support for a track / bill (coalition signal)
CREATE TABLE advocacy_actions (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL,                  -- 'pledge','contact_rep','petition'
  target_type TEXT NOT NULL,                  -- 'legislation','track'
  target_id   TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  UNIQUE (user_id, kind, target_type, target_id)
);
CREATE INDEX idx_actions_target ON advocacy_actions(target_type, target_id);

-- ──────────────────────────────────────────────────────────────────────
-- Billing (Stripe mirror)
-- ──────────────────────────────────────────────────────────────────────
CREATE TABLE subscriptions (
  id                TEXT PRIMARY KEY,         -- stripe subscription id
  user_id           TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan              TEXT NOT NULL,
  status            TEXT NOT NULL,            -- 'active','trialing','past_due','canceled'
  current_period_end INTEGER,
  updated_at        INTEGER NOT NULL
);
CREATE INDEX idx_subs_user ON subscriptions(user_id);
