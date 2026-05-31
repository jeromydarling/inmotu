-- inmotu — backfill coordinates for seeded tracks so the Competition Map and
-- landing hero map are populated. Only the 4 road-course tracks shipped with
-- lat/lng; these 13 (all real MN facilities) had none. Coordinates are the
-- track location (or its city centroid where exact siting is approximate).
-- Idempotent: keyed by id, only sets when currently null.

UPDATE tracks SET lat = 46.4186, lng = -94.0733 WHERE id = 'trk_brainerd_intl' AND lat IS NULL;
UPDATE tracks SET lat = 46.3580, lng = -94.2010 WHERE id = 'trk_barc' AND lat IS NULL;
UPDATE tracks SET lat = 46.4190, lng = -94.0700 WHERE id = 'trk_br*' AND lat IS NULL;
UPDATE tracks SET lat = 46.3600, lng = -94.2050 WHERE id = 'trk_dirt' AND lat IS NULL;
UPDATE tracks SET lat = 46.4200, lng = -94.0680 WHERE id = 'trk_endur' AND lat IS NULL;
UPDATE tracks SET lat = 45.3280, lng = -93.2480 WHERE id = 'trk_ckr' AND lat IS NULL;
UPDATE tracks SET lat = 44.3800, lng = -92.0300 WHERE id = 'trk_gopher' AND lat IS NULL;
UPDATE tracks SET lat = 44.9778, lng = -93.2650 WHERE id = 'trk_mira' AND lat IS NULL;
UPDATE tracks SET lat = 44.7390, lng = -93.1280 WHERE id = 'trk_dakota' AND lat IS NULL;
UPDATE tracks SET lat = 44.2410, lng = -92.2990 WHERE id = 'trk_mam' AND lat IS NULL;
UPDATE tracks SET lat = 44.2436, lng = -92.2999 WHERE id = 'trk_scr' AND lat IS NULL;
UPDATE tracks SET lat = 44.7980, lng = -93.5270 WHERE id = 'trk_proke' AND lat IS NULL;
UPDATE tracks SET lat = 44.5700, lng = -93.3270 WHERE id = 'trk_elko' AND lat IS NULL;
