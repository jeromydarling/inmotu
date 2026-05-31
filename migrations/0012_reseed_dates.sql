-- inmotu — keep the demo calendar fresh: re-date the seeded events to a rolling
-- near-future window relative to when this migration is applied, so a fresh
-- deploy months from now still shows an upcoming Grid / Competition Map / hero
-- instead of a stale calendar. One-shot (runs at apply time); targets the real
-- seeded event ids with explicit day offsets. Idempotent and replay-safe.

UPDATE events SET starts_at = strftime('%s','now') + 86400 * 6  WHERE id = 'evt_area_sc';
UPDATE events SET starts_at = strftime('%s','now') + 86400 * 6  WHERE id = 'evt_youth_clinic';
UPDATE events SET starts_at = strftime('%s','now') + 86400 * 13 WHERE id = 'evt_scca_brainerd';
UPDATE events SET starts_at = strftime('%s','now') + 86400 * 20 WHERE id = 'evt_regional_sc';
UPDATE events SET starts_at = strftime('%s','now') + 86400 * 27 WHERE id = 'evt_champcar_ra';
UPDATE events SET starts_at = strftime('%s','now') + 86400 * 34 WHERE id = 'evt_autocross_bir';
UPDATE events SET starts_at = strftime('%s','now') + 86400 * 41 WHERE id = 'evt_nasa_blackhawk';
UPDATE events SET starts_at = strftime('%s','now') + 86400 * 58 WHERE id = 'evt_loretta_national';

-- Consistent registration/end windows around each (re-dated) start.
UPDATE events
SET ends_at       = starts_at + 86400,
    reg_opens_at  = starts_at - 45 * 86400,
    reg_closes_at = starts_at - 4 * 86400
WHERE id IN ('evt_area_sc','evt_youth_clinic','evt_scca_brainerd','evt_regional_sc',
             'evt_champcar_ra','evt_autocross_bir','evt_nasa_blackhawk','evt_loretta_national');
