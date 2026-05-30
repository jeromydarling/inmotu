-- inmotu — AI growth suite: team microsites + saved marketing assets

-- Public, SEO-friendly team/family microsite (one per user, optional).
CREATE TABLE team_pages (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slug        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  tagline     TEXT,
  bio         TEXT,
  hometown    TEXT,
  discipline  TEXT,
  hero_slug   TEXT,                     -- AI image slug for the hero
  published   INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);
CREATE INDEX idx_team_pages_user ON team_pages(user_id);

-- AI Marketing Studio: a library of generated assets (social posts, promos,
-- sponsor thank-yous, press blurbs) so users can revisit/copy them.
CREATE TABLE marketing_assets (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL,            -- social | event_promo | sponsor_thanks | press | recap
  title       TEXT,
  body        TEXT NOT NULL,
  context     TEXT,                     -- json of inputs used (for regeneration)
  created_at  INTEGER NOT NULL
);
CREATE INDEX idx_marketing_user ON marketing_assets(user_id, created_at);
