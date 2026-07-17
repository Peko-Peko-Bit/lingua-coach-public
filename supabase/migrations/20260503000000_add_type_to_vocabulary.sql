ALTER TABLE vocabulary
  ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'word' CHECK (type IN ('word', 'phrase'));
