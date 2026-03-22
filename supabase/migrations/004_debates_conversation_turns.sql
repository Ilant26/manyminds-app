-- Multi-turn conversations: one history row, full thread in JSONB + merged `question` for search
ALTER TABLE debates
  ADD COLUMN IF NOT EXISTS conversation_turns JSONB NOT NULL DEFAULT '[]'::jsonb;
