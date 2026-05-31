-- inmotu — sectors. A user picks the racing community(ies) they belong to at
-- onboarding; the product adapts vocabulary, progression model, and which venue
-- categories surface. Stored as a JSON array of sector ids on the user.

ALTER TABLE users ADD COLUMN sectors TEXT NOT NULL DEFAULT '[]'; -- json SectorId[]

-- Expand venue categories to include BMX facilities (new sector). Existing
-- venues keep their category; the OSM importer + seed can now also tag 'bmx'.
-- (No constraint change needed — category is a free TEXT column.)
