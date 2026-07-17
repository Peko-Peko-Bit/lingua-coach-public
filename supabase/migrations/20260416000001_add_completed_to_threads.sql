-- threads テーブルに completed カラムを追加
-- Grammar mode で「終了」ボタンを押してトピックを修了マークした場合に true になる

ALTER TABLE threads
  ADD COLUMN IF NOT EXISTS completed boolean NOT NULL DEFAULT false;
