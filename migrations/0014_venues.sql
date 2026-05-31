-- inmotu — national venue canvas. The map's foundation: every US motorsports
-- facility as a permanent place (not a time-bound event), so the map is full
-- coast-to-coast on day one. Seeded with marquee venues now; an OSM/Overpass
-- importer scales it to thousands in production. Events/tracks layer on top.

CREATE TABLE venues (
  id          TEXT PRIMARY KEY,
  source      TEXT NOT NULL DEFAULT 'seed',   -- seed | osm | perplexity | manual
  osm_type    TEXT,                            -- node | way | relation
  osm_id      TEXT,
  name        TEXT NOT NULL,
  category    TEXT NOT NULL DEFAULT 'circuit', -- oval | motocross | road | drag | karting | circuit
  disciplines TEXT,                            -- json array of fine-grained tags
  surface     TEXT,                            -- dirt | paved | mixed
  city        TEXT,
  state       TEXT,                            -- 2-letter
  country     TEXT NOT NULL DEFAULT 'US',
  lat         REAL NOT NULL,
  lng         REAL NOT NULL,
  website     TEXT,
  status      TEXT NOT NULL DEFAULT 'active',  -- active | endangered | closed
  track_id    TEXT REFERENCES tracks(id) ON DELETE SET NULL, -- promoted/curated link
  tags        TEXT,                            -- json raw osm tags (provenance)
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);

CREATE UNIQUE INDEX idx_venues_osm ON venues(osm_type, osm_id);
CREATE INDEX idx_venues_category ON venues(category);
CREATE INDEX idx_venues_state ON venues(state);
CREATE INDEX idx_venues_status ON venues(status);
