-- USERS
CREATE TABLE users (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_id               TEXT UNIQUE NOT NULL,
  email                  TEXT NOT NULL,
  plan                   TEXT NOT NULL DEFAULT 'free',
  requests_used          INT NOT NULL DEFAULT 0,
  requests_limit         INT NOT NULL DEFAULT 5,
  billing_period_start   TIMESTAMPTZ DEFAULT NOW(),
  stripe_customer_id     TEXT,
  stripe_subscription_id TEXT,
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  updated_at             TIMESTAMPTZ DEFAULT NOW()
);

-- DEBATES
CREATE TABLE debates (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID REFERENCES users(id) ON DELETE CASCADE,
  question             TEXT NOT NULL,
  persona              TEXT,
  input_language       TEXT DEFAULT 'en',
  consensus_score      INT,
  has_disagreement     BOOLEAN DEFAULT FALSE,
  ai_responses         JSONB NOT NULL DEFAULT '[]',
  synthesis            TEXT,
  disagreement_details JSONB DEFAULT '[]',
  models_used          TEXT[] NOT NULL DEFAULT '{}',
  is_public            BOOLEAN DEFAULT FALSE,
  share_slug           TEXT UNIQUE,
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

-- EMAIL JOBS (idempotency)
CREATE TABLE email_jobs (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id  UUID REFERENCES users(id) ON DELETE CASCADE,
  type     TEXT NOT NULL,
  sent_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, type)
);

-- INDEXES
CREATE INDEX idx_debates_user_id    ON debates(user_id);
CREATE INDEX idx_debates_created_at ON debates(created_at DESC);
CREATE INDEX idx_debates_share_slug ON debates(share_slug) WHERE share_slug IS NOT NULL;
CREATE INDEX idx_users_clerk_id     ON users(clerk_id);

-- ROW LEVEL SECURITY
ALTER TABLE users    ENABLE ROW LEVEL SECURITY;
ALTER TABLE debates  ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_jobs ENABLE ROW LEVEL SECURITY;

-- Policies (service role bypasses RLS; these apply when using anon key + Clerk JWT)
CREATE POLICY users_own ON users FOR ALL USING (clerk_id = auth.jwt()->>'sub');
CREATE POLICY debates_own ON debates FOR ALL USING (user_id = (SELECT id FROM users WHERE clerk_id = auth.jwt()->>'sub'));
CREATE POLICY debates_public ON debates FOR SELECT USING (is_public = TRUE);
CREATE POLICY email_jobs_own ON email_jobs FOR ALL USING (user_id = (SELECT id FROM users WHERE clerk_id = auth.jwt()->>'sub'));
