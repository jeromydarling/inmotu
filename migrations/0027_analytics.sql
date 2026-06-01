-- inmotu — lightweight first-party analytics so we can SEE the funnel instead
-- of guessing where users drop off. Privacy-light: no PII, no third party. A
-- coarse day bucket + event name + optional label, counted. Rolled up on read.

CREATE TABLE analytics (
  id        TEXT PRIMARY KEY,
  day       TEXT NOT NULL,          -- 'YYYY-MM-DD' (UTC)
  event     TEXT NOT NULL,          -- 'pageview' | 'signup' | 'sector_pick' | 'near_me' | 'zip_search' | 'save_event' | 'discovery_run' | ...
  label     TEXT,                   -- optional dimension: path, sector, state…
  count     INTEGER NOT NULL DEFAULT 1,
  UNIQUE(day, event, label)
);

CREATE INDEX idx_analytics_day ON analytics(day);
CREATE INDEX idx_analytics_event ON analytics(event);
