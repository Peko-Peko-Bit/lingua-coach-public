"use client";

/**
 * hooks/useAIChat.ts
 *
 * Chat hook with provider switching and thread persistence.
 * - provider / threadId state management
 * - sends requests to /api/chat
 * - saves messages to IndexedDB (when threadId is set)
 * - accumulates conversation history
 * - on-demand translation via Google Translate API
 * - error handling
 */

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import type { AIResponse, ProviderType, Stage } from "@/lib/ai";
import { getMessagesByThread, putMessage } from "@/lib/db-client";
import { DEFAULT_LANGUAGE, type LanguageCode } from "@/lib/languages";

// ============================================================
// Practice types
// ============================================================
export interface PracticeExample {
  id:          string;
  original:    string;
  corrected:   string;
  explanation: string;
  created_at:  number;
}

// ============================================================
// Grammar mode payload type
// ============================================================
export interface GrammarTopicPayload {
  lang:             string;
  topic_id:         string;
  topic_name:       string | null;
  level:            string;
  content:          string;
  examples:         string[];
  explanation_lang: "ja" | "es";
}

// ============================================================
// Type definitions
// ============================================================
export interface ChatMessage {
  id:             string;
  role:           "user" | "assistant";
  content:        string;
  grammarCheck?:  AIResponse["grammar_check"] | null;
  translatedText?: string;
  isTranslating?: boolean;
  usedModel?:     string;
  usedFallback?:  boolean;
  stage?:         Stage;
  isHidden?:      boolean;
}

export interface ChatState {
  messages:          ChatMessage[];
  isLoading:         boolean;
  isLoadingMessages: boolean;
  error:             string | null;
  provider:          ProviderType;
  activeModelId:     string | null;
  usedFallback:      boolean;
}

// ============================================================
// Hook body
// ============================================================
export function useAIChat(
  initialProvider: ProviderType = "gemini-flash-lite",
  threadId: string | null = null,
  /** Callback called on first message send (for auto title generation) */
  onFirstMessage?: (threadId: string, text: string) => void,
  aiName?: string,
  language: LanguageCode = DEFAULT_LANGUAGE,
  characterId?: string,
  grammarMode?: boolean,
  grammarTopic?: GrammarTopicPayload,
  topicFocus?: string,
  explanationLang = "ja",
) {
  const [state, setState] = useState<ChatState>({
    messages:          [],
    isLoading:         false,
    isLoadingMessages: false,
    error:             null,
    provider:          initialProvider,
    activeModelId:     null,
    usedFallback:      false,
  });

  // ---- Anti-stale-closure: manage threadId / onFirstMessage / grammarTopic via refs ----
  const threadIdRef       = useRef<string | null>(threadId);
  const onFirstMessageRef = useRef(onFirstMessage);
  const grammarModeRef    = useRef(grammarMode);
  const grammarTopicRef   = useRef(grammarTopic);
  const topicFocusRef     = useRef(topicFocus);
  const explanationLangRef = useRef(explanationLang);

  useEffect(() => { threadIdRef.current        = threadId; },        [threadId]);
  useEffect(() => { onFirstMessageRef.current  = onFirstMessage; },  [onFirstMessage]);
  useEffect(() => { grammarModeRef.current     = grammarMode; },     [grammarMode]);
  useEffect(() => { grammarTopicRef.current    = grammarTopic; },    [grammarTopic]);
  useEffect(() => { topicFocusRef.current      = topicFocus; },      [topicFocus]);
  useEffect(() => { explanationLangRef.current = explanationLang; }, [explanationLang]);

  // ---- Load messages from IndexedDB when threadId changes ----
  useEffect(() => {
    let cancelled = false;

    if (!threadId) {
      setState((prev) => ({
        ...prev,
        messages:          [],
        isLoadingMessages: false,
        error:             null,
        activeModelId:     null,
        usedFallback:      false,
      }));
      return;
    }

    setState((prev) => ({
      ...prev,
      messages:          [],
      isLoadingMessages: true,
      error:             null,
      activeModelId:     null,
      usedFallback:      false,
    }));

    getMessagesByThread(threadId)
      .then((records) => {
        if (cancelled) return;
        const messages: ChatMessage[] = records.map((r) => ({
          id:           r.id,
          role:         r.role,
          content:      r.content,
          grammarCheck: r.grammarCheck as AIResponse["grammar_check"] | undefined,
          usedModel:    r.usedModel,
          usedFallback: r.usedFallback,
          stage:        r.stage as Stage | undefined,
        }));
        setState((prev) => ({
          ...prev,
          messages,
          isLoadingMessages: false,
          error:             null,
          activeModelId:     null,
          usedFallback:      false,
        }));
      })
      .catch(() => {
        if (cancelled) return;
        setState((prev) => ({ ...prev, isLoadingMessages: false }));
      });

    return () => { cancelled = true; };
  }, [threadId]);

  // --- Provider switching ---
  const setProvider = useCallback((provider: ProviderType) => {
    setState((prev) => ({ ...prev, provider, activeModelId: null, error: null }));
  }, []);

  // --- Send message ---
  const sendMessage = useCallback(
    async (userInput: string) => {
      if (!userInput.trim()) return;

      const currentThreadId = threadIdRef.current;
      const isFirstMsg      = state.messages.length === 0;

      const userMessage: ChatMessage = {
        id:      Date.now().toString(36) + Math.random().toString(36).slice(2),
        role:    "user",
        content: userInput.trim(),
      };

      setState((prev) => ({
        ...prev,
        messages:  [...prev.messages, userMessage],
        isLoading: true,
        error:     null,
      }));

      // Pass conversation history (last 20 messages) to /api/chat
      const history = state.messages
        .slice(-20)
        .map(({ role, content }) => ({ role, content }));

      console.log(
        `[Client → API] provider="${state.provider}" message="${userInput.trim().slice(0, 80)}"`
      );

      try {
        // Save user message to DB (inside try so a failure doesn't leave isLoading stuck)
        if (currentThreadId) {
          await putMessage({
            id:        userMessage.id,
            threadId:  currentThreadId,
            role:      "user",
            content:   userMessage.content,
            createdAt: Date.now(),
          });

          // First message → auto title generation callback
          if (isFirstMsg && onFirstMessageRef.current) {
            onFirstMessageRef.current(currentThreadId, userInput.trim());
          }
        }

        const res = await fetch("/api/chat", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({
            provider: state.provider,
            message:  userInput.trim(),
            history,
            aiName,
            language,
            characterId,
            ...(grammarModeRef.current && grammarTopicRef.current
              ? { grammar_mode: true, grammar_topic: grammarTopicRef.current }
              : {}),
            ...(topicFocusRef.current ? { topic_focus: topicFocusRef.current } : {}),
            explanation_lang: explanationLangRef.current,
          }),
        });

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          throw new Error(errBody.message ?? `Server error: ${res.status}`);
        }

        const result = (await res.json()) as {
          data:         AIResponse;
          usedModel:    string;
          usedFallback: boolean;
          provider:     ProviderType;
          stage?:       Stage;
        };

        console.log(
          `[API → Client] usedModel="${result.usedModel}" usedFallback=${result.usedFallback}`
        );

        const assistantMessage: ChatMessage = {
          id:           Date.now().toString(36) + Math.random().toString(36).slice(2),
          role:         "assistant",
          content:      result.data.response_text,
          grammarCheck: result.data.grammar_check,
          usedModel:    result.usedModel,
          usedFallback: result.usedFallback,
          stage:        result.stage,
        };

        setState((prev) => ({
          ...prev,
          messages:      [...prev.messages, assistantMessage],
          isLoading:     false,
          activeModelId: result.usedModel,
          usedFallback:  result.usedFallback,
        }));

        // Save assistant message to IndexedDB
        if (currentThreadId) {
          await putMessage({
            id:            assistantMessage.id,
            threadId:      currentThreadId,
            role:          "assistant",
            content:       assistantMessage.content,
            grammarCheck:  assistantMessage.grammarCheck,
            errorCategory:   result.data.grammar_check?.error_category ?? null,
            errorCategories: result.data.grammar_check?.error_categories ?? [],
            usedModel:     assistantMessage.usedModel,
            usedFallback:  assistantMessage.usedFallback,
            stage:         assistantMessage.stage,
            createdAt:     Date.now(),
          });
        }
      } catch (err) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error:     err instanceof Error ? err.message : "Unknown error occurred",
        }));
      }
    },
    [state.messages, state.provider, language, aiName, characterId]
  );

  // --- AI sends the first message (for Practice button) ---
  const sendGreeting = useCallback(async (practiceExamples?: PracticeExample[]) => {
    const focus           = topicFocusRef.current;
    const currentThreadId = threadIdRef.current;
    if (!focus) return;

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const res = await fetch("/api/chat", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          provider:    state.provider,
          message:     "Hello",   // hidden trigger, not shown in UI
          history:     [],
          aiName,
          language,
          characterId,
          topic_focus: focus,
          ...(practiceExamples && practiceExamples.length > 0
            ? { practice_examples: practiceExamples }
            : {}),
        }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.message ?? `Server error: ${res.status}`);
      }

      const result = (await res.json()) as {
        data:         AIResponse;
        usedModel:    string;
        usedFallback: boolean;
        provider:     ProviderType;
        stage?:       Stage;
      };

      const msg: ChatMessage = {
        id:           Date.now().toString(36) + Math.random().toString(36).slice(2),
        role:         "assistant",
        content:      result.data.response_text,
        grammarCheck: result.data.grammar_check,
        usedModel:    result.usedModel,
        usedFallback: result.usedFallback,
        stage:        result.stage,
      };

      const hiddenTrigger: ChatMessage = {
        id:       Date.now().toString(36) + Math.random().toString(36).slice(2),
        role:     "user",
        content:  "Hello",
        isHidden: true,
      };
      setState((prev) => ({
        ...prev,
        messages:      [...prev.messages, hiddenTrigger, msg],
        isLoading:     false,
        activeModelId: result.usedModel,
        usedFallback:  result.usedFallback,
      }));

      if (currentThreadId) {
        await putMessage({
          id:            msg.id,
          threadId:      currentThreadId,
          role:          "assistant",
          content:       msg.content,
          grammarCheck:  msg.grammarCheck,
          errorCategory: result.data.grammar_check?.error_category ?? null,
          isGreeting:    true,
          usedModel:     msg.usedModel,
          usedFallback:  msg.usedFallback,
          stage:         msg.stage,
          createdAt:     Date.now(),
        });
      }
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error:     err instanceof Error ? err.message : "Unknown error occurred",
      }));
    }
  }, [state.provider, aiName, language, characterId]);

  // --- On-demand translation via Google Translate ---
  const translateMessage = useCallback(
    async (messageId: string, text: string, targetLang = "ja") => {
      setState((prev) => ({
        ...prev,
        messages: prev.messages.map((m) =>
          m.id === messageId ? { ...m, isTranslating: true } : m
        ),
      }));

      try {
        const res = await fetch("/api/translate", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ text, target: targetLang }),
        });

        if (!res.ok) throw new Error(`Translate API error: ${res.status}`);

        const json = await res.json();
        const translated: string = json.translated ?? text;

        setState((prev) => ({
          ...prev,
          messages: prev.messages.map((m) =>
            m.id === messageId
              ? { ...m, translatedText: translated, isTranslating: false }
              : m
          ),
        }));
      } catch (err) {
        console.error("[Translate] Error:", err);
        setState((prev) => ({
          ...prev,
          messages: prev.messages.map((m) =>
            m.id === messageId ? { ...m, isTranslating: false } : m
          ),
        }));
      }
    },
    []
  );

  // --- Reset conversation (in-memory only; DB unchanged) ---
  const clearMessages = useCallback(() => {
    setState((prev) => ({
      ...prev,
      messages:      [],
      error:         null,
      activeModelId: null,
      usedFallback:  false,
    }));
  }, []);

  const filteredMessages = useMemo(
    () => state.messages.filter((m) => !m.isHidden),
    [state.messages]
  );

  return {
    ...state,
    messages: filteredMessages,
    setProvider,
    sendMessage,
    sendGreeting,
    translateMessage,
    clearMessages,
  };
}
