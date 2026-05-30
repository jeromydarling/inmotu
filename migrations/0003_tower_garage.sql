-- inmotu — Module 3 (The Tower) + Module 4 (The Garage)

-- Events gain an operator owner so tracks can manage their own listings.
ALTER TABLE events ADD COLUMN operator_id TEXT;
CREATE INDEX idx_events_operator ON events(operator_id);

-- ── Module 3: The Tower — registrations ───────────────────────────────
CREATE TABLE registrations (
  id          TEXT PRIMARY KEY,
  event_id    TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,  -- family account
  rider_id    TEXT REFERENCES riders(id) ON DELETE SET NULL,
  rider_name  TEXT NOT NULL,
  race_class  TEXT,
  status      TEXT NOT NULL DEFAULT 'confirmed'
                CHECK (status IN ('pending','confirmed','canceled')),
  amount_cents INTEGER,
  travel_miles INTEGER,                 -- feeds the economic-impact calculator
  created_at  INTEGER NOT NULL,
  UNIQUE (event_id, rider_id)
);
CREATE INDEX idx_reg_event ON registrations(event_id);
CREATE INDEX idx_reg_user ON registrations(user_id);

-- ── Module 4: The Garage — setups & stint plans ───────────────────────
CREATE TABLE vehicle_setups (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rider_id   TEXT REFERENCES riders(id) ON DELETE SET NULL,
  label      TEXT NOT NULL,
  track_id   TEXT REFERENCES tracks(id),
  conditions TEXT,                      -- 'dry / 85F', 'wet', etc.
  data       TEXT,                      -- json: springs, gearing, tire, psi, notes
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_setups_user ON vehicle_setups(user_id);

CREATE TABLE stint_plans (
  id             TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id       TEXT REFERENCES events(id) ON DELETE SET NULL,
  name           TEXT NOT NULL,
  race_minutes   INTEGER NOT NULL,
  stint_minutes  INTEGER NOT NULL,      -- planned driver stint length
  fuel_minutes   INTEGER NOT NULL,      -- fuel window (tank range in minutes)
  drivers        TEXT,                  -- json array of driver names
  created_at     INTEGER NOT NULL
);
CREATE INDEX idx_stints_user ON stint_plans(user_id);
