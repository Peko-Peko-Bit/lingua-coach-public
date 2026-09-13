/**
 * lib/db/index.ts
 * Supabase persistence layer — thread and message management
 */

import { createServerClient } from "@/lib/supabase-server";

// ============================================================
// Type definitions
// ============================================================
export interface ThreadRecord {
  id:              string;
  title:           string;
  lastUpdatedAt:   number;
  createdAt:       number;
  type:            "chat" | "grammar";
  grammarTopicId:  string | null;
  grammarLevel:    string | null;
  grammarUnitName: string | null;
  completed:       boolean;
  score:           number | null; // 0-100, null=unrated. 5-star: 1★=20…5★=100
  language:        string;        // ISO 639-1: 'es', 'en', etc.
  /**
   * AI tutor character, fixed for the lifetime of the thread.
   * null = legacy thread (resolves to the default character) or a grammar
   * thread, which has no character. Resolve via resolveCharacter().
   */
  characterId:     string | null;
}

export interface MessageRecord {
  id:             string;
  threadId:       string;
  role:           "user" | "assistant";
  content:        string;
  grammarCheck?:  {
    has_error:      boolean;
    original:       string;
    corrected:      string;
    explanation:    string;
    error_category?: string | null;
  } | null;
  errorCategory?:   string | null;
  errorCategories?: string[];
  isGreeting?:      boolean;
  usedModel?:     string;
  usedFallback?:  boolean;
  stage?:         string;
  createdAt:      number;
}

// ============================================================
// Threads
// ============================================================

export async function getAllThreads(): Promise<ThreadRecord[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("threads")
    .select("*")
    .eq("type", "chat")
    .order("last_updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(toThread);
}

export async function getGrammarThreads(userId: string): Promise<ThreadRecord[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("threads")
    .select("*")
    .eq("type", "grammar")
    .eq("user_id", userId)
    .order("last_updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(toThread);
}

export async function putThread(t: ThreadRecord): Promise<void> {
  const supabase = createServerClient();
  const { error } = await supabase
    .from("threads")
    .upsert(fromThread(t));
  if (error) throw error;
}

export async function updateThreadTitle(id: string, title: string): Promise<void> {
  const supabase = createServerClient();
  const { error } = await supabase
    .from("threads")
    .update({ title, last_updated_at: Date.now() })
    .eq("id", id);
  if (error) throw error;
}

export async function touchThread(id: string): Promise<void> {
  const supabase = createServerClient();
  const { error } = await supabase
    .from("threads")
    .update({ last_updated_at: Date.now() })
    .eq("id", id);
  if (error) throw error;
}

// ============================================================
// Messages
// ============================================================

export async function getMessagesByThread(threadId: string): Promise<MessageRecord[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(toMessage);
}

export async function putMessage(m: MessageRecord): Promise<void> {
  const supabase = createServerClient();
  const { error } = await supabase
    .from("messages")
    .upsert(fromMessage(m));
  if (error) throw error;
}

export async function completeThread(id: string, score: number): Promise<void> {
  const supabase = createServerClient();
  const { error } = await supabase
    .from("threads")
    .update({ completed: true, score, last_updated_at: Date.now() })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteThreadWithMessages(id: string): Promise<void> {
  // messages are auto-deleted via ON DELETE CASCADE
  const supabase = createServerClient();
  const { error } = await supabase
    .from("threads")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// ============================================================
// snake_case ↔ camelCase conversion
// ============================================================
function toThread(row: Record<string, unknown>): ThreadRecord {
  return {
    id:              row.id as string,
    title:           row.title as string,
    lastUpdatedAt:   row.last_updated_at as number,
    createdAt:       row.created_at as number,
    type:            (row.type as "chat" | "grammar") ?? "chat",
    grammarTopicId:  (row.grammar_topic_id as string | null) ?? null,
    grammarLevel:    (row.grammar_level as string | null) ?? null,
    grammarUnitName: (row.grammar_unit_name as string | null) ?? null,
    completed:       (row.completed as boolean) ?? false,
    score:           (row.score as number | null) ?? null,
    language:        (row.language as string) ?? "es",
    characterId:     (row.character_id as string | null) ?? null,
  };
}

function fromThread(t: ThreadRecord) {
  return {
    id:                t.id,
    title:             t.title,
    last_updated_at:   t.lastUpdatedAt,
    created_at:        t.createdAt,
    type:              t.type ?? "chat",
    grammar_topic_id:  t.grammarTopicId ?? null,
    grammar_level:     t.grammarLevel ?? null,
    grammar_unit_name: t.grammarUnitName ?? null,
    completed:         t.completed ?? false,
    score:             t.score ?? null,
    language:          t.language ?? "es",
    character_id:      t.characterId ?? null,
  };
}

function toMessage(row: Record<string, unknown>): MessageRecord {
  return {
    id:            row.id as string,
    threadId:      row.thread_id as string,
    role:          row.role as "user" | "assistant",
    content:       row.content as string,
    grammarCheck:  row.grammar_check as MessageRecord["grammarCheck"],
    errorCategory:   (row.error_category as string | null) ?? null,
    errorCategories: (row.error_categories as string[] | null) ?? [],
    isGreeting:      (row.is_greeting as boolean | null) ?? false,
    usedModel:     row.used_model as string | undefined,
    usedFallback:  row.used_fallback as boolean | undefined,
    stage:         row.stage as string | undefined,
    createdAt:     row.created_at as number,
  };
}

function fromMessage(m: MessageRecord) {
  return {
    id:             m.id,
    thread_id:      m.threadId,
    role:           m.role,
    content:        m.content,
    grammar_check:  m.grammarCheck ?? null,
    error_category:   m.errorCategory ?? null,
    error_categories: m.errorCategories ?? [],
    is_greeting:      m.isGreeting ?? false,
    used_model:     m.usedModel ?? null,
    used_fallback:  m.usedFallback ?? null,
    stage:          m.stage ?? null,
    created_at:     m.createdAt,
  };
}
