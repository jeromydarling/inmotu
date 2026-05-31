-- inmotu — MYLAPS/Speedhive live results integration

-- Link an event (and optionally a session) to a Speedhive event for live pulls.
ALTER TABLE events ADD COLUMN speedhive_event_id TEXT;
ALTER TABLE events ADD COLUMN speedhive_org_id TEXT;

-- Optional transponder / MYLAPS competitor id, for matching timing rows to a
-- known rider when the start number alone is ambiguous.
ALTER TABLE riders ADD COLUMN transponder TEXT;

-- A timed session within an event (practice / qualifying / heat / feature).
CREATE TABLE race_sessions (
  id                TEXT PRIMARY KEY,
  event_id          TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  source_session_id TEXT,                          -- Speedhive session id (provenance)
  name              TEXT NOT NULL,                 -- "Feature", "Heat 1", "Qualifying"
  race_class        TEXT,
  session_type      TEXT,                          -- practice|qualifying|heat|race
  status            TEXT NOT NULL DEFAULT 'scheduled', -- scheduled|running|finished
  started_at        INTEGER,
  source            TEXT NOT NULL DEFAULT 'manual', -- manual|speedhive
  refreshed_at      INTEGER,
  created_at        INTEGER NOT NULL,
  UNIQUE(event_id, source_session_id),
  UNIQUE(event_id, name, race_class)
);

-- Per-competitor classification rows for a session (the live standings grid).
CREATE TABLE live_results (
  id           TEXT PRIMARY KEY,
  session_id   TEXT NOT NULL REFERENCES race_sessions(id) ON DELETE CASCADE,
  rider_id     TEXT REFERENCES riders(id) ON DELETE SET NULL, -- matched rider, if any
  position     INTEGER,
  start_number TEXT,
  competitor   TEXT NOT NULL,
  laps         INTEGER,
  total_time   TEXT,
  best_lap     TEXT,
  last_lap     TEXT,
  gap          TEXT,                                -- gap to leader
  diff         TEXT,                                -- interval to car ahead
  status       TEXT,                                -- running|finished|dnf|dns
  updated_at   INTEGER NOT NULL,
  UNIQUE(session_id, competitor)
);

CREATE INDEX idx_sessions_event ON race_sessions(event_id);
CREATE INDEX idx_live_results_session ON live_results(session_id, position);
CREATE INDEX idx_live_results_rider ON live_results(rider_id);
