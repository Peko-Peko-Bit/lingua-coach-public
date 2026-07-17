-- Phase 1: 文法学習モード用テーブル作成
-- 既存テーブル (threads, messages, vocabulary) には一切触れない

-- ============================================================
-- grammar_units
-- ============================================================
create table grammar_units (
  unit_id       text not null,             -- "U01" 〜 "U19"
  target_lang   text not null,             -- ISO 639-1: 'es', 'en', 'zh' など
  "order"       integer not null,          -- 表示順（1〜19）
  advanced      boolean not null default false,
  levels        text[] not null,           -- ["B1", "B2"] など
  name_es       text not null,
  name_en       text not null,
  name_ja       text not null,
  dele_chapters text[] not null,
  dele_sections text[] not null,
  created_at    timestamptz default now(),
  primary key (unit_id, target_lang)       -- 言語をまたいで同じunit_idを使えるよう複合PK
);

-- ============================================================
-- grammar_topics
-- ============================================================
create table grammar_topics (
  id           text primary key,           -- "gram_B1_1.1.1_01"
  unit_id      text not null,
  target_lang  text not null,              -- ISO 639-1: 'es', 'en', 'zh' など
  topic_id     text not null,              -- "1.1.1"
  level        text not null check (level in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  chapter      text not null,
  section      text,
  subsection   text,
  topic_name   text,
  content      text not null,
  examples     text[] not null default '{}',
  created_at   timestamptz default now(),
  foreign key (unit_id, target_lang) references grammar_units(unit_id, target_lang)
);

-- 検索用インデックス
create index on grammar_topics (unit_id);
create index on grammar_topics (topic_id);
create index on grammar_topics (target_lang, level);
create index on grammar_topics (unit_id, target_lang, level);

-- ============================================================
-- grammar_progress
-- ============================================================
create table grammar_progress (
  id              uuid primary key default gen_random_uuid(),
  session_id      text not null,           -- localStorage管理のID
  target_lang     text not null,           -- ISO 639-1: 'es', 'en', 'zh' など
  unit_id         text not null,
  topic_id        text not null,
  level           text not null check (level in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  studied_at      timestamptz default now()
);

create index on grammar_progress (session_id);
create index on grammar_progress (session_id, target_lang, level);

-- ============================================================
-- grammar_settings
-- ============================================================
create table grammar_settings (
  session_id      text not null,
  target_lang     text not null,           -- ISO 639-1: 'es', 'en', 'zh' など
  level           text not null default 'B1' check (level in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  last_topic_id   text,
  last_unit_id    text,
  updated_at      timestamptz default now(),
  primary key (session_id, target_lang)    -- 言語ごとに設定を保持
);
