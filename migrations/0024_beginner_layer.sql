-- inmotu — the newcomer on-ramp. Flag beginner-friendly venues (tracks that
-- welcome first-timers: try-it days, rentals/arrive-and-drive, clinics) so a
-- curious family sees the EASY first step near them, not the Nationals.

ALTER TABLE venues ADD COLUMN beginner_friendly INTEGER NOT NULL DEFAULT 0;
ALTER TABLE venues ADD COLUMN starter_note TEXT;  -- "Rentals + Saturday clinics, all ages welcome"

CREATE INDEX idx_venues_beginner ON venues(beginner_friendly);

-- Flag a spread of real seeded venues across sectors as beginner-friendly,
-- with a short, honest "what makes this a good first stop" note.
UPDATE venues SET beginner_friendly = 1, starter_note = 'Olympic Training Center track — beginner clinics and rental bikes; all ages welcome' WHERE id = 'ven_bmx_chulavista';
UPDATE venues SET beginner_friendly = 1, starter_note = 'Weeknight beginner clinics and a balance-bike class — a classic first BMX track' WHERE id = 'ven_bmx_rockford';
UPDATE venues SET beginner_friendly = 1, starter_note = 'Big, welcoming program with new-racer nights and loaner gear' WHERE id = 'ven_bmx_cobb';
UPDATE venues SET beginner_friendly = 1, starter_note = 'Friday Test & Tune — bring any car, run what ya brung, no license needed to try' WHERE id = 'ven_drag_bristol';
UPDATE venues SET beginner_friendly = 1, starter_note = 'Grudge/Test nights and a Jr. Dragster program for ages 5-17' WHERE id = 'ven_drag_cordova';
UPDATE venues SET beginner_friendly = 1, starter_note = 'Arrive-and-drive karts + a learn-to-race school; the easiest way to try karting' WHERE id = 'ven_seed_041'; -- New Castle Motorsports Park
UPDATE venues SET beginner_friendly = 1, starter_note = 'Arrive-and-drive and LO206 rookie classes — show up and race' WHERE id = 'ven_seed_042'; -- GoPro Motorplex
UPDATE venues SET beginner_friendly = 1, starter_note = 'Beginner motocross schools and a PW/50cc class for the littlest riders' WHERE id = 'ven_seed_026'; -- Spring Creek MX
UPDATE venues SET beginner_friendly = 1, starter_note = 'SCCA Track Night in America — your street car, a helmet, and a coach' WHERE id = 'ven_seed_013'; -- Gingerman
UPDATE venues SET beginner_friendly = 1, starter_note = 'Novice autocross days — cones in a parking lot, lowest-risk way into motorsport' WHERE id = 'ven_seed_002'; -- Mid-Ohio
