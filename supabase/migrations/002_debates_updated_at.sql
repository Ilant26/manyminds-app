-- Track last activity so project/history lists can show newest imported or modified debates first
ALTER TABLE debates
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

UPDATE debates
SET updated_at = created_at
WHERE updated_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_debates_updated_at ON debates (updated_at DESC);
