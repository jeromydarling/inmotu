-- inmotu — stop presenting fabricated seed events as real. Flag demo/seed
-- events so the public Grid can hide them by default. A curious family should
-- see REAL events or an honest empty state — never a made-up race at a real
-- track. Real ingested events (source 'crawl'/'perplexity' or future feeds)
-- are NOT demo.

ALTER TABLE events ADD COLUMN demo INTEGER NOT NULL DEFAULT 0;

-- Mark the existing hand-seeded launch demo events as demo. These were inserted
-- by seed migrations (0002, 0021) — not real ingestion.
UPDATE events SET demo = 1
WHERE id IN (
  'evt_area_sc','evt_youth_clinic','evt_scca_brainerd','evt_regional_sc',
  'evt_champcar_ra','evt_autocross_bir','evt_nasa_blackhawk','evt_loretta_national',
  'evt_bmx_goldcup_cobb','evt_bmx_rockford_natl','evt_bmx_grands',
  'evt_drag_motorplex_bracket','evt_drag_cordova_worldfinals','evt_drag_bristol_test'
);
