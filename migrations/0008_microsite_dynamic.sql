-- inmotu — richer microsites: branding, socials, dynamic section toggles

ALTER TABLE team_pages ADD COLUMN accent_color TEXT;          -- hex, themes the page
ALTER TABLE team_pages ADD COLUMN socials TEXT;               -- json: {instagram,x,youtube,facebook,tiktok,website}
ALTER TABLE team_pages ADD COLUMN sections TEXT;              -- json: which dynamic blocks to show
ALTER TABLE team_pages ADD COLUMN featured_video TEXT;        -- YouTube/Vimeo URL to embed

-- Let families flag specific photos as public for the microsite gallery.
ALTER TABLE photos ADD COLUMN public INTEGER NOT NULL DEFAULT 0;
CREATE INDEX idx_photos_public ON photos(user_id, public);
