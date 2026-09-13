"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAIChat } from "@/hooks/useAIChat";
import type { GrammarTopicPayload } from "@/hooks/useAIChat";
import { GrammarChatHeader } from "@/components/grammar/GrammarChatHeader";
import { SessionEndDialog } from "@/components/grammar/SessionEndDialog";
import { MarkdownMessage } from "@/components/MarkdownMessage";
import { putThread, completeThread } from "@/lib/db-client";
import type { GrammarSession } from "@/lib/db/grammar";
import { BookOpen, ArrowRight } from "lucide-react";
import { FullScreenLoader } from "@/components/ui/FullScreenLoader";
import { Spinner } from "@/components/ui/Spinner";

// Get language code from localStorage (defaults to "es")
function getLanguage(): string {
  try {
    return localStorage.getItem("language") ?? "es";
  } catch {
    return "es";
  }
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// ============================================================
// Grammar session page body
// ============================================================
function GrammarSessionContent() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const topicId      = searchParams.get("topic_id") ?? "";
  const level        = searchParams.get("level") ?? "B1";
  // If thread_id is in URL, this is a resumed session
  const resumeThreadId = searchParams.get("thread_id");

  const [sessionData, setSessionData]         = useState<GrammarSession | null>(null);
  const [grammarPayload, setGrammarPayload]   = useState<GrammarTopicPayload | null>(null);
  const [explanationLang, setExplanationLang] = useState<"ja" | "es">("ja");
  const [threadId, setThreadId]               = useState<string | null>(null);
  const [isInitializing, setIsInitializing]   = useState(true);
  const [initError, setInitError]             = useState<string | null>(null);
  const [inputValue, setInputValue]           = useState("");
  const [endDialogOpen, setEndDialogOpen]     = useState(false);
  const [isSaving, setIsSaving]               = useState(false);
  const [currentLang, setCurrentLang]         = useState("es");

  // Skip auto-send on resumed sessions
  const hasAutoSentRef    = useRef(!!resumeThreadId);
  // Ref to access latest explanationLang from async init handler
  const explanationLangRef = useRef<"ja" | "es">("ja");
  const messagesEndRef  = useRef<HTMLDivElement>(null);
  const textareaRef     = useRef<HTMLTextAreaElement>(null);

  // ── Initialize: fetch session data + create/resume thread ──
  useEffect(() => {
    if (!topicId) {
      setInitError("topic_id is required");
      setIsInitializing(false);
      return;
    }

    const lang = getLanguage();
    setCurrentLang(lang);

    (async () => {
      try {
        const res = await fetch(
          `/api/grammar/session?topic_id=${encodeURIComponent(topicId)}&level=${encodeURIComponent(level)}&lang=${lang}`
        );
        if (!res.ok) throw new Error("Failed to load grammar data");
        const data: GrammarSession = await res.json();
        setSessionData(data);

        const payload: GrammarTopicPayload = {
          lang,
          topic_id:         data.topic_id,
          topic_name:       data.topic_name,
          level:            data.level,
          content:          data.content,
          examples:         data.examples,
          explanation_lang: explanationLangRef.current,
        };
        setGrammarPayload(payload);

        if (resumeThreadId) {
          // Resume: use existing thread
          setThreadId(resumeThreadId);
        } else {
          // New: create thread and save to DB
          const newThreadId = generateId();
          await putThread({
            id:              newThreadId,
            title:           data.topic_name ?? data.topic_id,
            lastUpdatedAt:   Date.now(),
            createdAt:       Date.now(),
            type:            "grammar",
            grammarTopicId:  data.topic_id,
            grammarLevel:    data.level,
            grammarUnitName: data.unit_name_ja ?? null,
            completed:       false,
            score:           null,
            language:        lang,
            characterId:     null,   // grammar mode runs without a character
          });
          setThreadId(newThreadId);
        }
      } catch (err) {
        setInitError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setIsInitializing(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topicId, level]);

  // Toggle explanation language → update both ref and payload
  useEffect(() => {
    explanationLangRef.current = explanationLang;
    setGrammarPayload((prev) =>
      prev ? { ...prev, explanation_lang: explanationLang } : prev
    );
  }, [explanationLang]);

  // ── Chat hook ──
  const {
    messages,
    isLoading,
    error,
    sendMessage,
    translateMessage,
  } = useAIChat(
    "gemini-flash-lite",
    threadId,           // Once thread ID is set, DB persistence is enabled
    undefined,          // onFirstMessage: title is already set at init time, not needed
    undefined,
    "es",
    undefined,
    !!grammarPayload,
    grammarPayload ?? undefined
  );

  // ── New session start: send initial message once grammarPayload + threadId are ready ──
  useEffect(() => {
    if (!grammarPayload || !threadId || hasAutoSentRef.current) return;
    hasAutoSentRef.current = true;
    sendMessage("Start the tutoring session for this grammar topic.");
  }, [grammarPayload, threadId, sendMessage]);

  // Scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      if (!inputValue.trim() || isLoading) return;
      const text = inputValue;
      setInputValue("");
      if (textareaRef.current) textareaRef.current.style.height = "auto";
      await sendMessage(text);
    },
    [inputValue, isLoading, sendMessage]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      // Desktop (640px+) only: Enter sends; mobile adds new line
      if (window.matchMedia("(min-width: 640px)").matches) {
        e.preventDefault();
        handleSubmit();
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 128) + "px";
  };

  const handleSaveAndEnd = async (score: number) => {
    setIsSaving(true);
    try {
      await Promise.all([
        // Mark thread as complete
        threadId ? completeThread(threadId, score) : Promise.resolve(),
        // Record progress (for future aggregation; keyed by the authenticated user server-side)
        sessionData
          ? fetch("/api/grammar/progress", {
              method:  "POST",
              headers: { "Content-Type": "application/json" },
              body:    JSON.stringify({
                lang:       currentLang,
                unit_id:    sessionData.unit_id,
                topic_id:   sessionData.topic_id,
                level:      sessionData.level,
              }),
            })
          : Promise.resolve(),
      ]);
    } catch (err) {
      console.error("[GrammarSession] Failed to complete:", err);
    } finally {
      setIsSaving(false);
      router.push("/grammar");
    }
  };

  // Hide the initial auto-sent user message ("Start the tutoring...")
  const visibleMessages = messages.filter((m, idx) => {
    if (idx === 0 && m.role === "user") return false;
    return true;
  });

  // ── Loading ──
  if (isInitializing) {
    return <FullScreenLoader />;
  }

  // ── Error ──
  if (initError) {
    return (
      <div className="flex flex-col h-[var(--app-height)] items-center justify-center bg-slate-950 p-6 gap-4">
        <p className="text-red-400 text-sm">{initError}</p>
        <button
          onClick={() => router.push("/grammar")}
          className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-sm hover:bg-slate-700 transition-colors"
        >
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[var(--app-height)] bg-slate-950 text-slate-100">
      {/* Header */}
      <GrammarChatHeader
        topicId={sessionData?.topic_id ?? topicId}
        topicName={sessionData?.topic_name ?? null}
        explanationLang={explanationLang}
        onLangToggle={() => setExplanationLang((l) => (l === "ja" ? "es" : "ja"))}
        onBack={() => router.push("/grammar")}
        onEnd={() => setEndDialogOpen(true)}
      />

      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-700/50">
        {visibleMessages.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Spinner />
            <p className="text-slate-500 text-sm">Preparing session…</p>
          </div>
        )}

        {visibleMessages.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-end gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {msg.role === "assistant" && (
              <div className="w-7 h-7 rounded-full bg-indigo-600/30 border border-indigo-500/30 flex items-center justify-center flex-shrink-0 mb-0.5">
                <BookOpen size={14} strokeWidth={2} className="text-indigo-400" />
              </div>
            )}

            <div className="max-w-[80%]">
              <div
                className={`px-4 py-3 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-indigo-600/30 border border-indigo-500/30 text-slate-200 rounded-[18px] rounded-br-[5px]"
                    : "bg-slate-800/80 border border-slate-700/50 text-slate-200 rounded-[18px] rounded-bl-[5px] prose-message"
                }`}
              >
                {msg.role === "user" ? (
                  msg.content
                ) : (
                  <MarkdownMessage content={msg.content} theme="indigo" />
                )}
              </div>

              {/* Translation button + model display */}
              {msg.role === "assistant" && (
                <div className="flex items-center justify-between gap-3 px-1 mt-1">
                  <button
                    onClick={() => translateMessage(msg.id, msg.content)}
                    disabled={msg.isTranslating}
                    className="text-[11px] text-slate-600 hover:text-indigo-400 transition-colors flex items-center gap-1 disabled:opacity-40"
                  >
                    <span>🌐</span>
                    <span>{msg.isTranslating ? "Translating…" : "Translation"}</span>
                  </button>
                  {msg.usedModel && (
                    <span className="text-[10px] text-slate-700 font-mono">
                      {msg.usedModel.split("/").pop()}
                    </span>
                  )}
                </div>
              )}

              {msg.translatedText && (
                <div className="px-3 py-2 bg-slate-800/50 rounded-xl border border-slate-700/40 mt-1">
                  <p className="text-[11px] text-slate-500 italic leading-relaxed">
                    {msg.translatedText}
                  </p>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {isLoading && (
          <div className="flex items-end gap-2">
            <div className="w-7 h-7 rounded-full bg-indigo-600/30 border border-indigo-500/30 flex items-center justify-center flex-shrink-0">
              <svg className="w-3.5 h-3.5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <div className="bg-slate-800/80 border border-slate-700/50 px-4 py-3.5 rounded-2xl rounded-bl-md">
              <div className="flex gap-1.5 items-center">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-400/60 animate-bounce [animation-delay:0ms]" />
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-400/60 animate-bounce [animation-delay:150ms]" />
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-400/60 animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-4 py-3 rounded-xl flex items-start gap-2">
            <span className="mt-0.5">⚠</span>
            <span>{error}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="flex-shrink-0 px-4 py-3.5 border-t border-indigo-500/15 bg-slate-900/85 backdrop-blur-xl">
        <form
          onSubmit={handleSubmit}
          className="flex gap-2.5 items-end bg-slate-800/80 border border-slate-700/60 rounded-3xl px-4 py-2.5
                     focus-within:border-indigo-500/50 transition-colors overflow-hidden"
        >
          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Try answering in Spanish…"
            rows={1}
            className="flex-1 min-w-0 resize-none bg-transparent text-slate-200 text-sm placeholder-slate-600
                       focus:outline-none leading-relaxed max-h-32 overflow-y-auto"
          />
          <button
            type="submit"
            disabled={isLoading || !inputValue.trim()}
            className="w-8 h-8 rounded-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30
                       disabled:cursor-not-allowed transition-colors flex items-center justify-center flex-shrink-0 active:scale-95"
          >
            <ArrowRight size={14} strokeWidth={2.5} className="text-white" />
          </button>
        </form>
      </div>

      {/* End dialog */}
      <SessionEndDialog
        isOpen={endDialogOpen}
        isSaving={isSaving}
        onCancel={() => setEndDialogOpen(false)}
        onConfirm={handleSaveAndEnd}
      />
    </div>
  );
}

// ============================================================
// Suspense wrapper (required for useSearchParams)
// ============================================================
export default function GrammarSessionPage() {
  return (
    <Suspense fallback={<FullScreenLoader />}>
      <GrammarSessionContent />
    </Suspense>
  );
}
