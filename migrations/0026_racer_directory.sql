-- inmotu — public racer directory. The third leg of the data moat (tracks,
-- events, crews → now racers). Riders are private by default; a family can
-- OPT IN to a public racer profile (slug + published), mirroring team_pages.
-- Privacy-first: nothing is public unless explicitly published.

ALTER TABLE riders ADD COLUMN slug TEXT;             -- public URL; set on publish
ALTER TABLE riders ADD COLUMN published INTEGER NOT NULL DEFAULT 0;  -- 0 = private
ALTER TABLE riders ADD COLUMN bio TEXT;              -- short public blurb
ALTER TABLE riders ADD COLUMN hometown TEXT;         -- "Millville, MN"

CREATE UNIQUE INDEX idx_riders_slug ON riders(slug) WHERE slug IS NOT NULL;
CREATE INDEX idx_riders_published ON riders(published);
