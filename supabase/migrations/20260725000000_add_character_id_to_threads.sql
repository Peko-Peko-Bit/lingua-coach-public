-- threads テーブルに character_id カラムを追加
-- AI チューターのキャラクター ID ('roberta', 'clara', 'ai' など。lib/characters.json が正)
-- スレッド（会話セッション）ごとにキャラクターを固定するため
--
-- NULL 許容・DEFAULT なし:
--   - 既存の chat スレッドは NULL のまま置き、読み取り時に既定キャラ（roberta）へ解決する
--     （lib/characters.ts の resolveCharacter）
--   - 文法モードのスレッド（type = 'grammar'）はキャラクターを持たないため常に NULL

ALTER TABLE threads
  ADD COLUMN IF NOT EXISTS character_id TEXT;
