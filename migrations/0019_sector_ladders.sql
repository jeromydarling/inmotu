-- inmotu — sector-specific ladders. The existing ladder model is linear stage
-- advancement (Area → Regional → National). Make it data-driven so each sport's
-- real path works without hardcoded rules, then seed the BMX and Drag ladders.

-- How a ladder advances, and per-stage advancement criteria/thresholds.
ALTER TABLE ladders ADD COLUMN progression TEXT NOT NULL DEFAULT 'ladder'; -- ladder | track_points
ALTER TABLE ladder_stages ADD COLUMN advance_note TEXT;     -- "Top 6 transfer", "Top 10 = NAG plate"
ALTER TABLE ladder_stages ADD COLUMN pos_advances INTEGER;  -- auto-advance threshold (null → default 6)

-- Backfill advancement notes on the existing motocross ladder stages.
UPDATE ladder_stages SET advance_note = 'Top 6 transfer to the next round', pos_advances = 6 WHERE id = 'stg_area_n';
UPDATE ladder_stages SET advance_note = 'Top finishers earn a spot at the National', pos_advances = 6 WHERE id = 'stg_regional_n';
UPDATE ladder_stages SET advance_note = 'Race for the championship at the Ranch', pos_advances = 1 WHERE id = 'stg_national';

-- ── BMX: "Road to the #1 Plate" (USA BMX) ────────────────────────────────────
INSERT OR IGNORE INTO ladders (id, name, discipline, season, progression) VALUES
  ('lad_bmx_2026', 'Road to the #1 Plate 2026', 'bmx', 2026, 'ladder');

INSERT OR IGNORE INTO ladder_stages (id, ladder_id, name, stage_order, region, advance_note, pos_advances) VALUES
  ('stg_bmx_district', 'lad_bmx_2026', 'District Points', 1, 'Home track', 'Race your home track all season for district points', 8),
  ('stg_bmx_state',    'lad_bmx_2026', 'State Championship', 2, 'State', 'Top finishers earn state plates', 3),
  ('stg_bmx_goldcup',  'lad_bmx_2026', 'Gold Cup Regional', 3, 'Gold Cup region', 'Chase your 1-2-3 plate across the region', 3),
  ('stg_bmx_national', 'lad_bmx_2026', 'National Series', 4, 'National', 'Earn national + NAG points on tour (best 8 scores)', 10),
  ('stg_bmx_grands',   'lad_bmx_2026', 'The Grands — Tulsa', 5, 'Grand Nationals', 'Top 10 = NAG plate · #1 plate = champion', 10);

-- ── Drag: "Track Points to Vegas" (NHRA Summit Racing Series) ─────────────────
INSERT OR IGNORE INTO ladders (id, name, discipline, season, progression) VALUES
  ('lad_drag_2026', 'Track Points to Vegas 2026', 'drag', 2026, 'track_points');

INSERT OR IGNORE INTO ladder_stages (id, ladder_id, name, stage_order, region, advance_note, pos_advances) VALUES
  ('stg_drag_track',   'lad_drag_2026', 'Track Points Championship', 1, 'Home strip', 'Bank weekly points at your home track all season', NULL),
  ('stg_drag_etfinals','lad_drag_2026', 'Division ET Finals', 2, 'NHRA Division', 'Top points-finishers make the division team', NULL),
  ('stg_drag_worlds',  'lad_drag_2026', 'Summit World Championship — Las Vegas', 3, 'National', 'Race for the jacket and the world title', 1);
