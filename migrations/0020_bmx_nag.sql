-- inmotu — BMX NAG points calculator. A rider logs the points they earn at each
-- race over the season; NAG standings use a rider's BEST 8 scores. This stores
-- the per-race scores; the best-8 math + "what you need next" projection is
-- computed on read.

CREATE TABLE bmx_scores (
  id        TEXT PRIMARY KEY,
  rider_id  TEXT NOT NULL REFERENCES riders(id) ON DELETE CASCADE,
  label     TEXT,                 -- e.g. "Gold Cup R3", "Music City Nationals"
  points    INTEGER NOT NULL,     -- points earned at this race
  raced_at  INTEGER,              -- epoch (optional; for ordering)
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_bmx_scores_rider ON bmx_scores(rider_id);
