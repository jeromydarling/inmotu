-- inmotu — seed reference & demo data (2026 season)

-- Disciplines ----------------------------------------------------------
INSERT INTO disciplines (slug, label, kind) VALUES
  ('motocross','Motocross','moto'),
  ('off-road','Off-Road / GNCC','moto'),
  ('autocross','Autocross','car'),
  ('road-race','Road Racing','car'),
  ('endurance','Endurance','car'),
  ('short-track','Short Track Oval','car'),
  ('karting','Karting','car');

-- Sanctioning bodies ---------------------------------------------------
INSERT INTO sanctioning_bodies (slug, label, url) VALUES
  ('ama','AMA / MX Sports','https://mxsports.com'),
  ('scca','Sports Car Club of America','https://www.scca.com'),
  ('nasa','National Auto Sport Association','https://nasaproracing.com'),
  ('champcar','ChampCar Endurance','https://champcar.org'),
  ('nascar-weekly','NASCAR Weekly Series','https://www.nascar.com'),
  ('independent','Independent Track','');

-- Tracks ---------------------------------------------------------------
INSERT INTO tracks (id, slug, name, discipline, surface, city, state, lat, lng, amenities, website, status, created_at) VALUES
  ('trk_spring_creek','spring-creek-mx','Spring Creek Motocross Park','motocross','dirt','Millville','MN',43.9794,-92.2543,'["camping","concessions","pro-shop"]','https://springcreekmx.com','active',1780000000),
  ('trk_millville_dunes','millville-dunes','Millville Dunes Practice Track','motocross','dirt','Millville','MN',43.97,-92.25,'["practice","camping"]','','active',1780000000),
  ('trk_loretta','loretta-lynn-ranch','Loretta Lynn''s Ranch','motocross','dirt','Hurricane Mills','TN',35.92,-87.71,'["camping","concessions","vendor-row"]','https://mxsports.com','active',1780000000),
  ('trk_brainerd','brainerd-intl-raceway','Brainerd International Raceway','road-race','asphalt','Brainerd','MN',46.41,-94.27,'["paddock","garages","camping"]','https://brainerdraceway.com','active',1780000000),
  ('trk_blackhawk','blackhawk-farms','Blackhawk Farms Raceway','road-race','asphalt','South Beloit','IL',42.47,-89.03,'["paddock","garages"]','https://blackhawkfarms.com','active',1780000000),
  ('trk_dakota','dakota-county-fast','Dakota County Speedway','short-track','asphalt','Lakeville','MN',44.65,-93.24,'["grandstand","concessions"]','','endangered',1780000000),
  ('trk_road_america','road-america','Road America','endurance','asphalt','Elkhart Lake','WI',43.80,-87.99,'["paddock","garages","camping"]','https://roadamerica.com','active',1780000000),
  ('trk_iowa_speedway','hawkeye-downs','Hawkeye Downs Speedway','short-track','asphalt','Cedar Rapids','IA',41.95,-91.69,'["grandstand"]','','active',1780000000);

-- Qualifying ladder: Road to Loretta Lynn 2026 ------------------------
INSERT INTO ladders (id, name, discipline, season) VALUES
  ('lad_rtll_2026','Road to Loretta Lynn 2026','motocross',2026);
INSERT INTO ladder_stages (id, ladder_id, name, stage_order, region) VALUES
  ('stg_area_n','lad_rtll_2026','Area Qualifier',1,'North Central'),
  ('stg_regional_n','lad_rtll_2026','Regional Championship',2,'North Central'),
  ('stg_national','lad_rtll_2026','AMA Amateur National',3,'National');

-- Events (2026 season) -------------------------------------------------
INSERT INTO events (id, slug, title, discipline, body_slug, track_id, region, level, age_group, starts_at, ends_at, reg_opens_at, reg_closes_at, entry_fee_cents, gate_fee_cents, external_url, source, ladder_id, created_at) VALUES
  ('evt_area_sc','area-qualifier-spring-creek','North Central Area Qualifier','motocross','ama','trk_spring_creek','North Central','qualifier','all',1780704000,1780790400,1779000000,1780531200,4500,1500,'https://mxsports.com','mxsports','stg_area_n',1780000000),
  ('evt_regional_sc','regional-championship-spring-creek','North Central Regional Championship','motocross','ama','trk_spring_creek','North Central','regional','all',1781913600,1782086400,1779600000,1781740800,7500,2000,'https://mxsports.com','mxsports','stg_regional_n',1780000000),
  ('evt_youth_clinic','youth-beginner-clinic','First Race? Youth Beginner Clinic','motocross','independent','trk_millville_dunes','North Central','beginner','youth',1780704000,NULL,1778400000,1780617600,2500,1000,'','manual',NULL,1780000000),
  ('evt_loretta_national','ama-amateur-national-2026','45th AMA Amateur National Championship','motocross','ama','trk_loretta','National','national','all',1785196800,1785715200,1780000000,1784592000,25000,3500,'https://mxsports.com','mxsports','stg_national',1780000000),
  ('evt_scca_brainerd','scca-club-race-brainerd','SCCA Land O'' Lakes Club Race','road-race','scca','trk_brainerd','Land O Lakes','club','amateur',1781308800,1781481600,1778000000,1781049600,32000,0,'https://www.motorsportreg.com','motorsportreg',NULL,1780000000),
  ('evt_champcar_ra','champcar-24-road-america','ChampCar 14-Hour Enduro','endurance','champcar','trk_road_america','Midwest','club','amateur',1782518400,1782604800,1777000000,1782259200,150000,0,'https://champcar.org','manual',NULL,1780000000),
  ('evt_autocross_bir','scca-autocross-points-3','SCCA Autocross — Points Event #3','autocross','scca','trk_brainerd','Land O Lakes','club','all',1783123200,NULL,1781000000,1782950400,4000,0,'https://www.motorsportreg.com','motorsportreg',NULL,1780000000),
  ('evt_nasa_blackhawk','nasa-hpde-blackhawk','NASA HPDE + Time Trial','road-race','nasa','trk_blackhawk','Great Lakes','club','amateur',1783728000,1783814400,1779000000,1783468800,29500,0,'https://nasaproracing.com','manual',NULL,1780000000);

-- Right to Race legislation (2025 enacted + 2026 active slate) ----------
INSERT INTO legislation (id, state, state_name, bill_number, title, summary, status, url, updated_at) VALUES
  ('leg_ia','IA','Iowa','HF 100','Iowa Right to Race Act','Landmark 2025 law shielding pre-existing motorsports facilities from nuisance suits.','enacted','https://www.sema.org/right-to-race',1780000000),
  ('leg_nc','NC','North Carolina','HB 926','North Carolina Racetrack Protection','Shields existing racetracks from neighbor noise suits within 3 miles.','enacted','https://www.newsweek.com',1780000000),
  ('leg_mn','MN','Minnesota','SF 2210','Minnesota Right to Race','SEMA-targeted bill protecting facilities that predate neighboring development.','committee','https://www.semahq.org/campaigns/right-to-race',1780000000),
  ('leg_ga','GA','Georgia','HB 488','Georgia Motorsports Facility Protection','Introduced 2026 to limit nuisance claims against established tracks.','introduced','https://www.sema.org/right-to-race',1780000000),
  ('leg_in','IN','Indiana','SB 312','Indiana Right to Race','Introduced 2026; coming-to-the-nuisance protections.','introduced','https://www.sema.org/right-to-race',1780000000),
  ('leg_ks','KS','Kansas','HB 2401','Kansas Racetrack Preservation','Introduced 2026.','introduced','https://www.sema.org/right-to-race',1780000000),
  ('leg_mo','MO','Missouri','HB 1577','Missouri Right to Race','In committee 2026.','committee','https://www.sema.org/right-to-race',1780000000),
  ('leg_oh','OH','Ohio','SB 88','Ohio Motorsports Protection','Introduced 2026.','introduced','https://www.sema.org/right-to-race',1780000000),
  ('leg_tn','TN','Tennessee','HB 0712','Tennessee Right to Race','Passed one chamber 2026.','passed','https://www.sema.org/right-to-race',1780000000),
  ('leg_tx','TX','Texas','HB 2199','Texas Racetrack Protection','Introduced 2026.','introduced','https://www.sema.org/right-to-race',1780000000),
  ('leg_wi','WI','Wisconsin','AB 154','Wisconsin Right to Race','In committee 2026.','committee','https://www.sema.org/right-to-race',1780000000),
  ('leg_pa','PA','Pennsylvania','HB 1330','Pennsylvania Motorsports Protection','Introduced 2026.','introduced','https://www.sema.org/right-to-race',1780000000),
  ('leg_va','VA','Virginia','HB 905','Virginia Right to Race','Introduced 2026.','introduced','https://www.sema.org/right-to-race',1780000000),
  ('leg_mi','MI','Michigan','SB 421','Michigan Racetrack Preservation','Introduced 2026.','introduced','https://www.sema.org/right-to-race',1780000000);

-- A sample verified threat on an endangered track ----------------------
INSERT INTO track_threats (id, track_id, reported_by, threat_type, description, verified, created_at) VALUES
  ('thr_dakota','trk_dakota',NULL,'development','Suburban housing development encroaching; noise complaints filed with county zoning board.',1,1780000000);
