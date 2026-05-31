-- inmotu — (no-op, retained for migration-number stability)
--
-- This slot originally tried to backfill track coordinates, but the canonical
-- 0002 seed already geolocates every track (id, ..., lat, lng, ...), so there is
-- nothing to backfill. Kept as a documented no-op rather than deleted because
-- this migration was already recorded as applied in existing environments;
-- removing the file would not re-run anything but would break replay parity.
--
-- If a future seed adds tracks without coordinates, add guarded UPDATEs here
-- (always `WHERE id = '...' AND lat IS NULL`).

SELECT 1;
