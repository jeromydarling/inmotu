-- inmotu — photo timeline + season yearbook (Lulu print revenue)

-- Parent/family photo & video timeline, stored in R2 (key = r2_key).
CREATE TABLE photos (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rider_id   TEXT REFERENCES riders(id) ON DELETE SET NULL,
  event_id   TEXT REFERENCES events(id) ON DELETE SET NULL,
  r2_key     TEXT NOT NULL,
  content_type TEXT,
  caption    TEXT,
  taken_at   INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_photos_user ON photos(user_id, created_at);
CREATE INDEX idx_photos_rider ON photos(rider_id);

-- End-of-season printed photo book orders (fulfilled via Lulu Print API).
CREATE TABLE yearbook_orders (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rider_id      TEXT REFERENCES riders(id) ON DELETE SET NULL,
  season        INTEGER NOT NULL,
  title         TEXT,
  status        TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','paid','submitted','printed','shipped','canceled')),
  photo_count   INTEGER NOT NULL DEFAULT 0,
  amount_cents  INTEGER,
  stripe_session_id TEXT,
  lulu_job_id   TEXT,
  ship_name     TEXT,
  ship_address  TEXT,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL
);
CREATE INDEX idx_yearbook_user ON yearbook_orders(user_id);
