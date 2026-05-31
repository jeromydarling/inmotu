-- inmotu — add BMX and Drag Racing as first-class disciplines so their events
-- and tracks filter correctly by sector. Idempotent.

INSERT OR IGNORE INTO disciplines (slug, label, kind) VALUES
  ('bmx','BMX Racing','moto'),
  ('drag','Drag Racing','car');
