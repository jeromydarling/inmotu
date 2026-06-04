-- inmotu — email auth flows: password reset, email verification, welcome.
-- Uses Cloudflare Email Sending (env.EMAIL). Tokens are stored HASHED (we never
-- keep the raw token), single-use, and expiring.

-- Email verification state. Nudge-not-block; only enforced for free users in UI.
ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0;

-- One table for both reset + verify tokens (kind distinguishes them).
CREATE TABLE auth_tokens (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL,            -- 'reset' | 'verify'
  token_hash  TEXT NOT NULL,           -- SHA-256 of the raw token (never store raw)
  expires_at  INTEGER NOT NULL,
  used_at     INTEGER,
  created_at  INTEGER NOT NULL
);

CREATE INDEX idx_auth_tokens_hash ON auth_tokens(token_hash);
CREATE INDEX idx_auth_tokens_user ON auth_tokens(user_id, kind);
