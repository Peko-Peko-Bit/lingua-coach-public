-- threads テーブルに grammar_unit_name カラムを追加
-- Grammar mode スレッド作成時にユニット名（日本語）を非正規化して保存する

ALTER TABLE threads
  ADD COLUMN IF NOT EXISTS grammar_unit_name text;
