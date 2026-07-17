-- threads テーブルに Grammar mode 用カラムを追加
--
-- type           : 'chat'（通常チャット）または 'grammar'（文法学習）
-- grammar_topic_id: Grammar スレッドのトピック ID（例: "1.2.02"）
-- grammar_level  : Grammar スレッドのレベル（例: "B1"）

ALTER TABLE threads
  ADD COLUMN IF NOT EXISTS type            text NOT NULL DEFAULT 'chat',
  ADD COLUMN IF NOT EXISTS grammar_topic_id text,
  ADD COLUMN IF NOT EXISTS grammar_level   text;

ALTER TABLE threads
  DROP CONSTRAINT IF EXISTS threads_type_check;

ALTER TABLE threads
  ADD CONSTRAINT threads_type_check CHECK (type IN ('chat', 'grammar'));
