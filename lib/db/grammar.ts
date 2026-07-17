/**
 * lib/db/grammar.ts
 * Supabase DB operations for grammar learning mode
 */

import { createServerClient } from "@/lib/supabase-server";

// ============================================================
// Type definitions
// ============================================================

export interface GrammarUnit {
  unit_id:      string;
  order:        number;
  advanced:     boolean;
  name_ja:      string;
  name_en:      string;
  name_es:      string;
  topic_count:  number;
}

export interface GrammarTopic {
  id:          string;
  topic_id:    string;
  topic_name:  string | null;
  chapter:     string;
  section:     string | null;
  examples:    string[];
}

export interface GrammarSession {
  id:           string;
  unit_id:      string;
  unit_name_ja: string | null;
  topic_id:     string;
  level:        string;
  topic_name:   string | null;
  chapter:      string;
  section:      string | null;
  subsection:   string | null;
  content:      string;
  examples:     string[];
}

export interface GrammarSettings {
  level:         string;
  last_topic_id: string | null;
  last_unit_id:  string | null;
}

// ============================================================
// grammar_units
// ============================================================

export async function getUnits(lang: string, level: string): Promise<GrammarUnit[]> {
  const supabase = createServerClient();
  // Fetch unit list (units that include the specified level)
  const { data: units, error: unitsError } = await supabase
    .from("grammar_units")
    .select("unit_id, order, advanced, name_ja, name_en, name_es")
    .eq("target_lang", lang)
    .contains("levels", [level])
    .order("order", { ascending: true });

  if (unitsError) throw unitsError;
  if (!units || units.length === 0) return [];

  // Fetch topic count (counted per unit_id)
  const { data: topicRows, error: topicsError } = await supabase
    .from("grammar_topics")
    .select("unit_id")
    .eq("target_lang", lang)
    .eq("level", level);

  if (topicsError) throw topicsError;

  const countMap: Record<string, number> = {};
  for (const row of topicRows ?? []) {
    countMap[row.unit_id] = (countMap[row.unit_id] ?? 0) + 1;
  }

  return units.map((u) => ({
    unit_id:     u.unit_id,
    order:       u.order,
    advanced:    u.advanced,
    name_ja:     u.name_ja,
    name_en:     u.name_en,
    name_es:     u.name_es,
    topic_count: countMap[u.unit_id] ?? 0,
  }));
}

// ============================================================
// grammar_topics
// ============================================================

export async function getTopics(
  lang: string,
  unit_id: string,
  level: string
): Promise<GrammarTopic[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("grammar_topics")
    .select("id, topic_id, topic_name, chapter, section, examples")
    .eq("target_lang", lang)
    .eq("unit_id", unit_id)
    .eq("level", level)
    .order("topic_id", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

// ============================================================
// grammar_session (for RAG)
// ============================================================

export async function getSession(
  lang: string,
  topic_id: string,
  level: string
): Promise<GrammarSession | null> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("grammar_topics")
    .select("id, unit_id, topic_id, level, topic_name, chapter, section, subsection, content, examples")
    .eq("target_lang", lang)
    .eq("topic_id", topic_id)
    .eq("level", level)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // no rows
    throw error;
  }

  // Fetch unit name
  const { data: unitRow } = await supabase
    .from("grammar_units")
    .select("name_ja")
    .eq("target_lang", lang)
    .eq("unit_id", data.unit_id)
    .single();

  return { ...data, unit_name_ja: (unitRow?.name_ja as string) ?? null };
}

// ============================================================
// Fetch next incomplete topic
// ============================================================

export async function getNextTopic(
  userId: string,
  lang: string,
  current_topic_id: string,
  level: string
): Promise<{ topic_id: string; topic_name: string | null; unit_id: string } | null> {
  const supabase = createServerClient();
  // Fetch topics after current in ascending order
  const { data: topics, error: topicsError } = await supabase
    .from("grammar_topics")
    .select("topic_id, topic_name, unit_id")
    .eq("target_lang", lang)
    .eq("level", level)
    .gt("topic_id", current_topic_id)
    .order("topic_id", { ascending: true });

  if (topicsError) throw topicsError;
  if (!topics || topics.length === 0) return null;

  // Build a set of completed topic_ids from threads with completed=true at the same level
  const { data: completedThreads, error: threadsError } = await supabase
    .from("threads")
    .select("grammar_topic_id")
    .eq("user_id", userId)
    .eq("type", "grammar")
    .eq("grammar_level", level)
    .eq("completed", true);

  if (threadsError) throw threadsError;

  const completedSet = new Set(
    (completedThreads ?? []).map((t) => t.grammar_topic_id as string)
  );

  // Skip completed topics and return the first incomplete one
  for (const topic of topics) {
    if (!completedSet.has(topic.topic_id)) {
      return {
        topic_id:   topic.topic_id,
        topic_name: topic.topic_name as string | null,
        unit_id:    topic.unit_id as string,
      };
    }
  }

  return null;
}

// ============================================================
// grammar_progress
// ============================================================

export async function saveProgress(
  userId: string,
  lang: string,
  unit_id: string,
  topic_id: string,
  level: string
): Promise<void> {
  const supabase = createServerClient();

  // No unique constraint on (user_id, lang, topic_id, level), so dedupe
  // here to keep repeated completions from growing the table unboundedly.
  const { data: existing, error: selectError } = await supabase
    .from("grammar_progress")
    .select("id")
    .eq("user_id", userId)
    .eq("target_lang", lang)
    .eq("topic_id", topic_id)
    .eq("level", level)
    .limit(1);
  if (selectError) throw selectError;
  if (existing && existing.length > 0) return;

  const { error } = await supabase.from("grammar_progress").insert({
    session_id: userId, // legacy NOT NULL column; now keyed by user id
    user_id: userId,
    target_lang: lang,
    unit_id,
    topic_id,
    level,
  });
  if (error) throw error;
}

// ============================================================
// grammar_settings
// ============================================================

export async function getSettings(
  userId: string,
  lang: string
): Promise<GrammarSettings> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("grammar_settings")
    .select("level, last_topic_id, last_unit_id")
    .eq("session_id", userId)
    .eq("target_lang", lang)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      // No settings yet — return defaults
      return { level: "B1", last_topic_id: null, last_unit_id: null };
    }
    throw error;
  }
  return {
    level:         data.level,
    last_topic_id: data.last_topic_id ?? null,
    last_unit_id:  data.last_unit_id ?? null,
  };
}

export async function saveSettings(
  userId: string,
  lang: string,
  level: string,
  last_topic_id: string | null,
  last_unit_id: string | null
): Promise<void> {
  const supabase = createServerClient();
  const { error } = await supabase.from("grammar_settings").upsert(
    {
      session_id:    userId, // legacy NOT NULL PK column; now keyed by user id
      user_id:       userId,
      target_lang:   lang,
      level,
      last_topic_id: last_topic_id ?? null,
      last_unit_id:  last_unit_id ?? null,
      updated_at:    new Date().toISOString(),
    },
    { onConflict: "session_id,target_lang" }
  );
  if (error) throw error;
}
