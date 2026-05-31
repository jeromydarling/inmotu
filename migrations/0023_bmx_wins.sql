-- inmotu — BMX "wins to next class" counter. USA BMX proficiency advances by
-- wins: ~10 Novice→Intermediate, ~20 Intermediate→Expert. Track a rider's win
-- count so we can show how many wins until they move up. skill_level already
-- holds the proficiency (novice/intermediate/expert).

ALTER TABLE riders ADD COLUMN wins INTEGER NOT NULL DEFAULT 0;
