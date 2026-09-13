"use client";

/**
 * hooks/useThreads.ts
 * Hook for managing, switching, and deleting thread list
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
  getAllThreads,
  getMessagesByThread,
  putThread,
  deleteThreadWithMessages,
  updateThreadTitle,
  touchThread as dbTouchThread,
  type ThreadRecord,
} from "@/lib/db-client";
import { type LanguageCode } from "@/lib/languages";
import { resolveCharacterIdForLanguage } from "@/lib/characters";
import { readLastCharacterId, writeLastCharacterId } from "@/lib/character-preference";

export type { ThreadRecord };

export function useThreads(language: LanguageCode) {
  const [threads, setThreads]               = useState<ThreadRecord[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [isLoaded, setIsLoaded]             = useState(false);
  const [deletingId, setDeletingId]         = useState<string | null>(null);

  // Anti-stale-closure: keep latest threads value in a ref
  const threadsRef = useRef(threads);
  useEffect(() => { threadsRef.current = threads; }, [threads]);

  // On startup: only load thread list from DB. Selection/creation is handled by page.tsx.
  useEffect(() => {
    getAllThreads()
      .then((ts) => {
        setThreads(ts);
        setIsLoaded(true);
      })
      .catch((err) => {
        console.error("[useThreads] failed to load threads:", err);
        setIsLoaded(true); // unblock the startup loader even on failure
      });
  }, []);

  /**
   * Create a new thread and make it active.
   *
   * The character is fixed here for the lifetime of the thread. Pass one to
   * start a chat with a specific character (the empty-state picker does this,
   * which also makes it the pre-selection for later chats); omit it to inherit
   * the last selected character.
   */
  const createThread = useCallback(async (characterId?: string): Promise<string> => {
    const threadCharacterId = resolveCharacterIdForLanguage(
      characterId ?? readLastCharacterId(),
      language,
    );
    if (characterId) writeLastCharacterId(threadCharacterId);

    // Delete all empty threads (0 messages)
    const emptyIds: string[] = [];
    await Promise.all(
      threadsRef.current.map(async (t) => {
        const msgs = await getMessagesByThread(t.id);
        if (msgs.length === 0) emptyIds.push(t.id);
      })
    );
    if (emptyIds.length > 0) {
      await Promise.all(emptyIds.map((id) => deleteThreadWithMessages(id)));
      setThreads((prev) => prev.filter((t) => !emptyIds.includes(t.id)));
    }

    const now    = Date.now();
    const thread: ThreadRecord = {
      id:              now.toString(36) + Math.random().toString(36).slice(2),
      title:           "New Chat",
      lastUpdatedAt:   now,
      createdAt:       now,
      type:            "chat",
      grammarTopicId:  null,
      grammarLevel:    null,
      grammarUnitName: null,
      completed:       false,
      score:           null,
      language,
      characterId:     threadCharacterId,
    };
    await putThread(thread);
    setThreads((prev) => [thread, ...prev]);
    setActiveThreadId(thread.id);
    return thread.id;
  }, [language]);

  /** Select a thread */
  const selectThread = useCallback((id: string) => {
    setActiveThreadId(id);
  }, []);

  /** Delete a thread and its messages */
  const deleteThread = useCallback(async (id: string) => {
    setDeletingId(id);
    try {
      await deleteThreadWithMessages(id);
      setThreads((prev) => {
        const next = prev.filter((t) => t.id !== id);
        // If the deleted thread was active, switch to the first remaining thread
        setActiveThreadId((current) => {
          if (current !== id) return current;
          return next.length > 0 ? next[0].id : null;
        });
        return next;
      });
    } finally {
      setDeletingId(null);
    }
  }, []);

  /** Update a thread title (used for auto-title on first message) */
  const updateTitle = useCallback(async (id: string, title: string) => {
    await updateThreadTitle(id, title);
    const now = Date.now();
    setThreads((prev) =>
      prev
        .map((t) => (t.id === id ? { ...t, title, lastUpdatedAt: now } : t))
        .sort((a, b) => b.lastUpdatedAt - a.lastUpdatedAt)
    );
  }, []);

  /** Update lastUpdatedAt and move the thread to the top */
  const touchThread = useCallback(async (id: string) => {
    await dbTouchThread(id);
    const now = Date.now();
    setThreads((prev) =>
      prev
        .map((t) => (t.id === id ? { ...t, lastUpdatedAt: now } : t))
        .sort((a, b) => b.lastUpdatedAt - a.lastUpdatedAt)
    );
  }, []);

  return {
    threads,
    activeThreadId,
    isLoaded,
    deletingId,
    createThread,
    selectThread,
    deleteThread,
    updateTitle,
    touchThread,
  };
}
