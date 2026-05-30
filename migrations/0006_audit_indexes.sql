-- inmotu — audit follow-up: missing indexes for hot/uncovered query paths.

-- Reverse FK index: announcement recipients + comms UNION scan saved_events by event
CREATE INDEX IF NOT EXISTS idx_saved_events_event ON saved_events(event_id);

-- Events feed: region/level filters + date sort
CREATE INDEX IF NOT EXISTS idx_events_region_starts ON events(region, starts_at);
CREATE INDEX IF NOT EXISTS idx_events_level_starts ON events(level, starts_at);

-- Demo-account cleanup scan (cron purge)
CREATE INDEX IF NOT EXISTS idx_users_demo_created ON users(is_demo, created_at);

-- Standings aggregation: cover the join + grouping keys
CREATE INDEX IF NOT EXISTS idx_results_event_class
  ON results(event_id, race_class, competitor, points, position);

-- series_events reverse lookup by event
CREATE INDEX IF NOT EXISTS idx_series_events_event ON series_events(event_id);

-- Tower registration count + economic-impact rollup
CREATE INDEX IF NOT EXISTS idx_reg_event_status ON registrations(event_id, status);

-- Budget summary GROUP BY category
CREATE INDEX IF NOT EXISTS idx_budget_user_cat ON budget_entries(user_id, category);

-- Announcements within an event ordered by recency
CREATE INDEX IF NOT EXISTS idx_ann_event_created ON announcements(event_id, created_at);

-- Maintenance log per-rider time ordering
CREATE INDEX IF NOT EXISTS idx_maint_rider_perf ON maintenance_logs(rider_id, performed_at);
