-- threads テーブルに score カラムを追加
-- Grammar mode 修了時のユーザー評価スコア（0-100）
-- NULL = 未評価、値あり = 評価済み（= 修了）
-- 5段階評価: 1★=20, 2★=40, 3★=60, 4★=80, 5★=100

ALTER TABLE threads
  ADD COLUMN IF NOT EXISTS score smallint
  CHECK (score >= 0 AND score <= 100);
