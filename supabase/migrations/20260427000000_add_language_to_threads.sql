-- threads テーブルに language カラムを追加
-- ISO 639-1 言語コード ('es', 'en', 'ko' など)
-- 既存データは全て 'es' で埋める

ALTER TABLE threads
  ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'es';

UPDATE threads SET language = 'es' WHERE language IS NULL;
