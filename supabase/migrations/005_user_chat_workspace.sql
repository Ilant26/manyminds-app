-- Workspace chat (panneaux + brouillons) synchronisé par compte, tous appareils
CREATE TABLE IF NOT EXISTS user_chat_workspace (
  user_id    UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  payload    JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_chat_workspace_updated_at
  ON user_chat_workspace (updated_at DESC);
