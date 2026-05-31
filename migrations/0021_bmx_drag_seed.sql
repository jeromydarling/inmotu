-- inmotu — real BMX + drag content so the new sectors land on something live.
-- Venues (map pins), a few curated tracks for the flagship facilities, and
-- future-dated events on them (relative dates so they're always upcoming).
-- Idempotent via INSERT OR IGNORE on stable ids.

-- Sanctioning bodies for the new sectors (events.body_slug FK).
INSERT OR IGNORE INTO sanctioning_bodies (slug, label, url) VALUES
  ('usabmx','USA BMX','https://www.usabmx.com'),
  ('nhra','NHRA','https://www.nhra.com');

-- ── BMX venues (USA BMX tracks) ──────────────────────────────────────────────
INSERT OR IGNORE INTO venues (id, source, name, category, surface, city, state, lat, lng, website, created_at, updated_at) VALUES
  ('ven_bmx_hardesty','seed','Hardesty National BMX Stadium','bmx','dirt','Tulsa','OK',36.1545,-95.9760,'https://www.usabmx.com/tracks/ok-hardesty-national-bmx-stadium',1780000000,1780000000),
  ('ven_bmx_rockford','seed','Rockford BMX','bmx','dirt','Rockford','IL',42.3197,-89.0648,'https://www.rockfordbmx.com',1780000000,1780000000),
  ('ven_bmx_cobb','seed','Cobb County BMX','bmx','dirt','Powder Springs','GA',33.8745,-84.6905,'https://cobbcountybmx.com',1780000000,1780000000),
  ('ven_bmx_chulavista','seed','Chula Vista BMX','bmx','dirt','Chula Vista','CA',32.6195,-116.9555,'https://chulavistabmx.com',1780000000,1780000000),
  ('ven_bmx_derbycity','seed','Derby City BMX','bmx','dirt','Louisville','KY',38.2935,-85.5610,'https://www.usabmx.com/tracks/ky-derby-city-bmx',1780000000,1780000000),
  ('ven_bmx_southpark','seed','South Park BMX','bmx','dirt','Bethel Park','PA',40.2980,-79.9990,'https://www.usabmx.com/tracks/pa-south-park-bmx',1780000000,1780000000),
  ('ven_bmx_blackmtn','seed','Black Mountain BMX Raceway','bmx','dirt','Phoenix','AZ',33.7000,-112.0640,'http://www.blackmountainbmx.com',1780000000,1780000000),
  ('ven_bmx_seatac','seed','SeaTac BMX','bmx','dirt','SeaTac','WA',47.4990,-122.3120,'https://www.seatacbmx.com',1780000000,1780000000),
  ('ven_bmx_tricity','seed','Tri-City BMX','bmx','dirt','Schenectady','NY',42.8430,-73.9760,'https://www.usabmx.com/tracks/ny-tri-city-(ny)-bmx',1780000000,1780000000),
  ('ven_bmx_lonestar','seed','Lone Star BMX','bmx','dirt','San Antonio','TX',29.5085,-98.4015,'https://lonestarbmxsa.square.site',1780000000,1780000000);

-- ── Drag venues (strips) ─────────────────────────────────────────────────────
INSERT OR IGNORE INTO venues (id, source, name, category, surface, city, state, lat, lng, website, created_at, updated_at) VALUES
  ('ven_drag_bristol','seed','Bristol Dragway','drag','paved','Bristol','TN',36.5160,-82.2570,'https://www.bristoldragway.com',1780000000,1780000000),
  ('ven_drag_gainesville','seed','Gainesville Raceway','drag','paved','Gainesville','FL',29.8190,-82.3260,'https://gainesvilleraceway.com',1780000000,1780000000),
  ('ven_drag_maplegrove','seed','Maple Grove Raceway','drag','paved','Mohnton','PA',40.2390,-75.9760,'https://www.maplegroveraceway.com',1780000000,1780000000),
  ('ven_drag_motorplex','seed','Texas Motorplex','drag','paved','Ennis','TX',32.3286,-96.7181,'https://www.texasmotorplex.com',1780000000,1780000000),
  ('ven_drag_firebird','seed','Firebird Motorsports Park','drag','paved','Chandler','AZ',33.2689,-111.9672,'https://www.racefirebird.com',1780000000,1780000000),
  ('ven_drag_cordova','seed','Cordova Dragway','drag','paved','Cordova','IL',41.7172,-90.2986,'https://cordovadragwaypark.com',1780000000,1780000000),
  ('ven_drag_us131','seed','US 131 Motorsports Park','drag','paved','Martin','MI',42.5290,-85.6420,'https://us131msp.com',1780000000,1780000000),
  ('ven_drag_woodburn','seed','Woodburn Dragstrip','drag','paved','Woodburn','OR',45.1558,-122.9069,'https://woodburndragstrip.com',1780000000,1780000000),
  ('ven_drag_nationaltrail','seed','National Trail Raceway','drag','paved','Hebron','OH',39.9560,-82.5290,'https://nationaltrailraceway.com',1780000000,1780000000),
  ('ven_drag_lebanonvalley','seed','Lebanon Valley Dragway','drag','paved','West Lebanon','NY',42.4520,-73.4150,'https://www.dragway.com',1780000000,1780000000),
  ('ven_drag_sgmp','seed','South Georgia Motorsports Park','drag','paved','Cecil','GA',31.0647,-83.3964,'https://www.goracesgmp.com',1780000000,1780000000);

-- ── Curated tracks for flagship facilities (so events can attach + show) ──────
INSERT OR IGNORE INTO tracks (id, slug, name, discipline, surface, city, state, lat, lng, amenities, website, status, created_at) VALUES
  ('trk_hardesty','hardesty-national-bmx','Hardesty National BMX Stadium','bmx','dirt','Tulsa','OK',36.1545,-95.9760,'["indoor","concessions","pro-shop"]','https://www.usabmx.com','active',1780000000),
  ('trk_rockford_bmx','rockford-bmx','Rockford BMX','bmx','dirt','Rockford','IL',42.3197,-89.0648,'["concessions"]','https://www.rockfordbmx.com','active',1780000000),
  ('trk_cobb_bmx','cobb-county-bmx','Cobb County BMX','bmx','dirt','Powder Springs','GA',33.8745,-84.6905,'["concessions"]','https://cobbcountybmx.com','active',1780000000),
  ('trk_motorplex','texas-motorplex','Texas Motorplex','drag','paved','Ennis','TX',32.3286,-96.7181,'["grandstands","concessions"]','https://www.texasmotorplex.com','active',1780000000),
  ('trk_bristol_drag','bristol-dragway','Bristol Dragway','drag','paved','Bristol','TN',36.5160,-82.2570,'["grandstands","concessions"]','https://www.bristoldragway.com','active',1780000000),
  ('trk_cordova','cordova-dragway','Cordova Dragway','drag','paved','Cordova','IL',41.7172,-90.2986,'["grandstands","camping"]','https://cordovadragwaypark.com','active',1780000000);

-- Link those venues to their curated tracks (so the canvas drawer surfaces events).
UPDATE venues SET track_id = 'trk_hardesty'    WHERE id = 'ven_bmx_hardesty';
UPDATE venues SET track_id = 'trk_rockford_bmx' WHERE id = 'ven_bmx_rockford';
UPDATE venues SET track_id = 'trk_cobb_bmx'    WHERE id = 'ven_bmx_cobb';
UPDATE venues SET track_id = 'trk_motorplex'   WHERE id = 'ven_drag_motorplex';
UPDATE venues SET track_id = 'trk_bristol_drag' WHERE id = 'ven_drag_bristol';
UPDATE venues SET track_id = 'trk_cordova'     WHERE id = 'ven_drag_cordova';

-- ── Future-dated events (relative to apply time so always upcoming) ───────────
INSERT OR IGNORE INTO events (id, slug, title, discipline, body_slug, track_id, region, level, age_group, starts_at, ends_at, reg_opens_at, reg_closes_at, entry_fee_cents, gate_fee_cents, external_url, source, created_at) VALUES
  ('evt_bmx_goldcup_cobb','gold-cup-southeast-cobb','Gold Cup Southeast — Cobb County','bmx','usabmx','trk_cobb_bmx','Southeast','regional','all',
     strftime('%s','now')+86400*12, strftime('%s','now')+86400*13, strftime('%s','now')-86400*30, strftime('%s','now')+86400*10, 4000,1000,'https://www.usabmx.com','usabmx',1780000000),
  ('evt_bmx_rockford_natl','great-lakes-nationals-rockford','Great Lakes Nationals','bmx','usabmx','trk_rockford_bmx','North Central','national','all',
     strftime('%s','now')+86400*26, strftime('%s','now')+86400*27, strftime('%s','now')-86400*30, strftime('%s','now')+86400*24, 6500,1500,'https://www.usabmx.com','usabmx',1780000000),
  ('evt_bmx_grands','grand-nationals-tulsa','USA BMX Grand Nationals','bmx','usabmx','trk_hardesty','National','national','all',
     strftime('%s','now')+86400*55, strftime('%s','now')+86400*59, strftime('%s','now')-86400*30, strftime('%s','now')+86400*50, 9000,2000,'https://www.usabmx.com','usabmx',1780000000),
  ('evt_drag_motorplex_bracket','fall-bracket-bash-motorplex','Fall Bracket Bash','drag','nhra','trk_motorplex','South Central','club','all',
     strftime('%s','now')+86400*9, strftime('%s','now')+86400*10, strftime('%s','now')-86400*20, strftime('%s','now')+86400*8, 4500,2000,'https://www.texasmotorplex.com','nhra',1780000000),
  ('evt_drag_cordova_worldfinals','cordova-world-bracket-finals','Cordova World Bracket Finals','drag','independent','trk_cordova','North Central','regional','all',
     strftime('%s','now')+86400*20, strftime('%s','now')+86400*23, strftime('%s','now')-86400*40, strftime('%s','now')+86400*18, 12000,2500,'https://cordovadragwaypark.com','independent',1780000000),
  ('evt_drag_bristol_test','thunder-valley-test-tune','Thunder Valley Test & Tune','drag','nhra','trk_bristol_drag','Southeast','club','all',
     strftime('%s','now')+86400*5, NULL, strftime('%s','now')-86400*10, strftime('%s','now')+86400*4, 3000,1500,'https://www.bristoldragway.com','nhra',1780000000);
