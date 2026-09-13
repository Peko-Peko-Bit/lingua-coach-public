"use client";
/**
 * lib/db-client.ts
 * Client-safe DB wrapper — all operations go through API routes.
 * Drop-in replacement for lib/db/index.ts in client components/hooks.
 */

import type { ThreadRecord, MessageRecord } from "@/lib/db";
export type { ThreadRecord, MessageRecord };

async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(input, init);
  if (res.status === 401) {
    throw new Error("Unauthorized");
  }
  return res;
}

// snake_case row → ThreadRecord (mirrors lib/db/index.ts toThread)
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

// ThreadRecord → snake_case row
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

// snake_case row → MessageRecord
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

// MessageRecord → snake_case row
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

// ============================================================
// Threads
// ============================================================

export async function getAllThreads(): Promise<ThreadRecord[]> {
  const res = await apiFetch("/api/threads");
  if (!res.ok) throw new Error("Failed to fetch threads");
  const rows: Record<string, unknown>[] = await res.json();
  return rows.map(toThread);
}

export async function putThread(t: ThreadRecord): Promise<void> {
  const res = await apiFetch("/api/threads", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(fromThread(t)),
  });
  if (!res.ok) throw new Error("Failed to upsert thread");
}

export async function updateThreadTitle(id: string, title: string): Promise<void> {
  const res = await apiFetch(`/api/threads/${id}`, {
    method:  "PATCH",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ title }),
  });
  if (!res.ok) throw new Error("Failed to update thread title");
}

export async function touchThread(id: string): Promise<void> {
  const res = await apiFetch(`/api/threads/${id}`, {
    method:  "PATCH",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({}),
  });
  if (!res.ok) throw new Error("Failed to touch thread");
}

export async function completeThread(id: string, score: number): Promise<void> {
  const res = await apiFetch(`/api/threads/${id}`, {
    method:  "PATCH",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ completed: true, score }),
  });
  if (!res.ok) throw new Error("Failed to complete thread");
}

export async function deleteThreadWithMessages(id: string): Promise<void> {
  const res = await apiFetch(`/api/threads/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete thread");
}

// ============================================================
// Messages
// ============================================================

export async function getMessagesByThread(threadId: string): Promise<MessageRecord[]> {
  const res = await apiFetch(`/api/threads/${threadId}/messages`);
  if (!res.ok) throw new Error("Failed to fetch messages");
  const rows: Record<string, unknown>[] = await res.json();
  return rows.map(toMessage);
}

export async function putMessage(m: MessageRecord): Promise<void> {
  const res = await apiFetch(`/api/threads/${m.threadId}/messages`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(fromMessage(m)),
  });
  if (!res.ok) throw new Error("Failed to upsert message");
}
