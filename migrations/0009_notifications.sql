-- inmotu — notifications: in-app center, web-push subs, delivery prefs

CREATE TABLE notifications (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL,            -- deadline | announcement | ladder | system
  title      TEXT NOT NULL,
  body       TEXT,
  href       TEXT,                     -- in-app link target
  read       INTEGER NOT NULL DEFAULT 0,
  -- dedupe key so the cron never sends the same alert twice
  dedupe_key TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_notif_user ON notifications(user_id, created_at);
CREATE INDEX idx_notif_unread ON notifications(user_id, read);
CREATE UNIQUE INDEX idx_notif_dedupe ON notifications(user_id, dedupe_key);

-- Web Push subscriptions (browser PushManager). One device = one row.
CREATE TABLE push_subscriptions (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint   TEXT NOT NULL UNIQUE,
  p256dh     TEXT NOT NULL,
  auth       TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_push_user ON push_subscriptions(user_id);

-- Per-user delivery preferences (JSON-free, simple columns).
ALTER TABLE users ADD COLUMN notify_email INTEGER NOT NULL DEFAULT 1;
ALTER TABLE users ADD COLUMN notify_push INTEGER NOT NULL DEFAULT 1;
ALTER TABLE users ADD COLUMN notify_deadlines INTEGER NOT NULL DEFAULT 1;
