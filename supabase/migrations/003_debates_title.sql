-- Short user-facing title for history / project lists (full thread stays in `question`)
ALTER TABLE debates
  ADD COLUMN IF NOT EXISTS title TEXT;

UPDATE debates
SET title = LEFT(BTRIM(split_part(question, E'\n', 1)), 120)
WHERE title IS NULL OR BTRIM(COALESCE(title, '')) = '';
