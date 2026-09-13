"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAIChat } from "@/hooks/useAIChat";
import { useThreads } from "@/hooks/useThreads";
import { useTheme } from "@/hooks/useTheme";
import { useLanguage } from "@/hooks/useLanguage";
import { useProfile } from "@/hooks/useProfile";
import { useVocabulary } from "@/hooks/useVocabulary";
import { resolveCharacter } from "@/lib/characters";
import { useLastCharacterId } from "@/lib/character-preference";
import { LANGUAGE_LIST, type LanguageCode } from "@/lib/languages";
import { Sidebar } from "@/components/Sidebar";
import { CharacterPicker } from "@/components/CharacterPicker";
import { SettingsModal } from "@/components/SettingsModal";
import { VocabularyPopup } from "@/components/VocabularyPopup";
import { Avatar } from "@/components/Avatar";
import { GrammarModeToggle } from "@/components/grammar/GrammarModeToggle";
import { FullScreenLoader } from "@/components/ui/FullScreenLoader";
import { Spinner } from "@/components/ui/Spinner";
import { MarkdownMessage } from "@/components/MarkdownMessage";
import { CircleCheck, Check, Menu, ChevronDown, SquarePen, ArrowRight, X, FileText } from "lucide-react";
import type { AIResponse } from "@/lib/ai";
import type { PracticeExample } from "@/hooks/useAIChat";

// ============================================================
// Right panel — Grammar Check display
// ============================================================
type GrammarStatus = "error" | "advice" | "perfect";

function parseExplanationItems(text: string): string[] {
  const parts = text.split(/\s*\d+\.\s+/).filter(Boolean);
  return parts.length > 1 ? parts : [text];
}

function getGrammarStatus(check: AIResponse["grammar_check"]): GrammarStatus {
  if (!check) return "perfect";
  if (check.has_error) return "error";
  if (check.explanation) return "advice";
  return "perfect";
}

function GrammarPanel({
  displayedCheck,
  displayedUserMessage,
}: {
  displayedCheck: AIResponse["grammar_check"] | null;
  displayedUserMessage: string;
}) {
  if (!displayedCheck) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 px-6">
        <div className="w-12 h-12 rounded-full bg-[var(--bg-elevated)] flex items-center justify-center">
          <FileText size={24} strokeWidth={1.5} className="text-[var(--text-dim)]" />
        </div>
        <p className="text-[var(--text-muted)] text-sm text-center leading-relaxed">
          Send a message to see<br />grammar check results here
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 p-5 overflow-y-auto h-full">
      <div>
        <p className="text-xs font-semibold text-[var(--text-dim)] uppercase tracking-widest mb-2">
          Your message
        </p>
        <p className="text-[var(--text-primary)] text-sm leading-relaxed">{displayedUserMessage}</p>
      </div>

      <div className="h-px bg-[var(--border)]" />

      <div>
        <p className="text-xs font-semibold text-[var(--text-dim)] uppercase tracking-widest mb-2">
          Corrected message
        </p>
        {displayedCheck.has_error ? (
          <div className="flex items-start gap-3 bg-emerald-500/5 border border-emerald-500/15 rounded-xl px-3 py-2.5">
            <span className="text-emerald-400 text-xs font-bold mt-0.5">✓</span>
            <p className="text-emerald-300 text-sm leading-relaxed font-medium">
              {displayedCheck.corrected}
            </p>
          </div>
        ) : displayedCheck.explanation ? (
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
              <span className="text-amber-400 text-[10px] font-bold">!</span>
            </div>
            <p className="text-amber-300 text-sm">Correct — but see tip below</p>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
              <Check size={12} strokeWidth={2.5} className="text-emerald-400" />
            </div>
            <p className="text-emerald-400 text-sm">No errors — perfect!</p>
          </div>
        )}
      </div>

      {(displayedCheck.has_error || displayedCheck.explanation) && displayedCheck.explanation && (
        <>
          <div className="h-px bg-[var(--border)]" />
          <div>
            <p className="text-xs font-semibold text-[var(--text-dim)] uppercase tracking-widest mb-3">
              Explanation
            </p>
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-amber-400" />
                <span className="text-amber-400 text-xs font-semibold uppercase tracking-wide">
                  {displayedCheck.has_error ? "Grammar note" : "Grammar tip"}
                </span>
              </div>
              {(() => {
                const items = parseExplanationItems(displayedCheck.explanation);
                return items.length > 1 ? (
                  <ol className="list-none space-y-2">
                    {items.map((item, i) => (
                      <li key={i} className="flex gap-2 text-sm leading-relaxed">
                        <span className="text-amber-400 font-semibold flex-shrink-0 mt-0.5">{i + 1}.</span>
                        <span className="text-[#d4c5a0]">{item.trim()}</span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-[#d4c5a0] text-sm leading-relaxed">{displayedCheck.explanation}</p>
                );
              })()}
            </div>
          </div>

        </>
      )}
    </div>
  );
}

// ============================================================
// Main page
// ============================================================
export default function ChatPage() {
  const [inputValue, setInputValue]         = useState("");
  const [latestCheck, setLatestCheck]       = useState<AIResponse["grammar_check"] | null>(null);
  const [latestUserMessage, setLatestUserMessage] = useState("");
  const [sidebarOpen, setSidebarOpen]       = useState(true);
  const [grammarOpen, setGrammarOpen]       = useState(false);
  const [explanationLang, setExplanationLang] = useState<"ja" | "en" | "es">("ja");
  const [settingsOpen, setSettingsOpen]     = useState(false);
  const [topicFocus, setTopicFocus]           = useState<string | undefined>(undefined);
  const [pendingThreadId, setPendingThreadId]  = useState<string | null>(null);
  const [paramsRead, setParamsRead]            = useState(false);
  const [practiceExamples, setPracticeExamples] = useState<PracticeExample[] | null>(null);
  const [isStarting, setIsStarting]            = useState(true);
  const [selectedGrammarMsgId, setSelectedGrammarMsgId] = useState<string | null>(null);
  const greetingSentRef   = useRef(false);
  const startupDoneRef    = useRef(false);
  const prevMessageCountRef = useRef(0);
  const router = useRouter();

  const [isSwitchingLanguage, setIsSwitchingLanguage] = useState(false);
  const [isCreatingThread, setIsCreatingThread]       = useState(false);
  const isCreatingThreadRef = useRef(false);

  // ---- Language dropdown ----
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);
  const langDropdownRef = useRef<HTMLDivElement>(null);
  const pendingLangSwitchRef = useRef(false);

  // Read ?topic= / ?threadId= / ?examples= query params (client-side only)
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const t   = params.get("topic");
      const tid = params.get("threadId");
      const ex  = params.get("examples");
      if (t)   setTopicFocus(t);
      if (tid) setPendingThreadId(tid);
      if (ex)  {
        try { setPracticeExamples(JSON.parse(decodeURIComponent(ex))); } catch {}
      }
    } catch {}
    // Until this runs we don't know whether this is a practice thread, and the
    // character picker must not be shown for those.
    setParamsRead(true);
  }, []);
  const messagesEndRef  = useRef<HTMLDivElement>(null);
  const inputBarRef     = useRef<HTMLDivElement>(null);
  const textareaRef     = useRef<HTMLTextAreaElement>(null);

  // ---- Language ----
  const { language, setLanguage, langConfig } = useLanguage();

  // ---- Theme (language-linked + light/dark/system) ----
  const { theme, colorMode, setColorMode } = useTheme(language);

  // ---- Profile ----
  const { profile, updateUserAvatar, isResizing: isResizingAvatar } = useProfile();


  // ---- Thread management ----
  const {
    threads,
    activeThreadId,
    isLoaded,
    deletingId: deletingThreadId,
    createThread,
    selectThread,
    deleteThread,
    updateTitle,
    touchThread,
  } = useThreads(language);

  // ---- Character (fixed per thread) ----
  // Comes from the active thread, never from a global setting, so past
  // conversations keep the character they were held with.
  const activeCharacter = resolveCharacter(
    threads.find((t) => t.id === activeThreadId)?.characterId
  );
  const characterAvatarSrc = activeCharacter.avatarSrc;
  const aiName = activeCharacter.name;
  // Pre-selection for the picker: the last character the user chose. While the
  // thread list is still loading there is no thread to read from, so the picker
  // shows this instead of flashing the default.
  const lastCharacterId = useLastCharacterId();

  // On startup: always open a new chat (runs once; ref prevents re-fire on language switch)
  useEffect(() => {
    if (!isLoaded || startupDoneRef.current) return;
    startupDoneRef.current = true;
    // Read URL directly (not from state) — state updates from sibling effects aren't visible yet
    if (new URLSearchParams(window.location.search).get("threadId")) {
      setIsStarting(false);
      return;
    }
    (async () => {
      try {
        await createThread();
      } catch (err) {
        console.error("[startup] failed to create thread:", err);
      } finally {
        setIsStarting(false);
      }
    })();
  }, [isLoaded, createThread]);

  // If threadId is specified in URL, select it after loading
  useEffect(() => {
    if (isLoaded && pendingThreadId) {
      selectThread(pendingThreadId);
      setPendingThreadId(null);
    }
  }, [isLoaded, pendingThreadId, selectThread]);

  // Create new thread after language switch (via useEffect to wait for state update)
  useEffect(() => {
    if (!pendingLangSwitchRef.current) {
      setIsSwitchingLanguage(false);
      return;
    }
    pendingLangSwitchRef.current = false;
    createThread()
      .then(() => setIsSwitchingLanguage(false))
      .catch(() => setIsSwitchingLanguage(false));
  }, [language]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close language dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (langDropdownRef.current && !langDropdownRef.current.contains(e.target as Node)) {
        setLangDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSwitchLanguage = (newLang: LanguageCode) => {
    if (newLang === language) { setLangDropdownOpen(false); return; }
    pendingLangSwitchRef.current = true;
    setIsSwitchingLanguage(true);
    setLanguage(newLang);
    setLangDropdownOpen(false);
  };

  const handleFirstMessage = useCallback(
    (threadId: string, text: string) => {
      const title = text.length > 20 ? text.slice(0, 20) + "…" : text;
      updateTitle(threadId, title);
    },
    [updateTitle]
  );

  const startNewThread = useCallback(async (characterId?: string) => {
    if (isCreatingThreadRef.current) return;
    isCreatingThreadRef.current = true;
    setIsCreatingThread(true);
    try {
      await createThread(characterId);
    } finally {
      isCreatingThreadRef.current = false;
      setIsCreatingThread(false);
    }
  }, [createThread]);

  // Wrappers take no event argument on purpose: these are wired straight to
  // onClick, which would otherwise pass the MouseEvent as characterId.
  const handleNewChat = useCallback(() => { startNewThread(); }, [startNewThread]);

  // Picking a character starts a fresh thread with it. The current thread is
  // still empty at this point, and createThread() clears empty threads, so this
  // retags the chat in place rather than piling up threads.
  const handleSelectCharacter = useCallback(
    (characterId: string) => { startNewThread(characterId); },
    [startNewThread]
  );

  // ---- Vocabulary ----
  const activeThreadTitle = threads.find((t) => t.id === activeThreadId)?.title ?? "New Chat";
  const {
    entries: vocabEntries,
    addEntry: addVocabEntry,
    deleteEntry: deleteVocabEntry,
    isLoading: isVocabLoading,
    lemmatizingIds,
  } = useVocabulary(activeThreadId, activeThreadTitle);

  // ---- Chat ----
  const {
    messages,
    isLoading,
    isLoadingMessages,
    error,
    provider,
    activeModelId,
    usedFallback,
    setProvider,
    sendMessage,
    sendGreeting,
    translateMessage,
  } = useAIChat("gemini-flash-lite", activeThreadId, handleFirstMessage, aiName, language, activeCharacter.id, undefined, undefined, topicFocus, explanationLang);

  // Threads opened via Practice button: AI speaks first
  useEffect(() => {
    if (
      topicFocus &&
      activeThreadId &&
      messages.length === 0 &&
      !greetingSentRef.current
    ) {

      greetingSentRef.current = true;
      setTopicFocus(undefined);
      const examples = practiceExamples;
      setPracticeExamples(null);
      // Clean up URL → prevents re-trigger on reload
      router.replace("/");
      sendGreeting(examples ?? undefined);
    }
  }, [activeThreadId, topicFocus, messages.length, sendGreeting, router, practiceExamples]);

  // Hide sidebar initially on mobile
  useEffect(() => {
    if (window.innerWidth < 1024) setSidebarOpen(false);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (messages.length === 0) {
      setLatestCheck(null);
      setLatestUserMessage("");
      setSelectedGrammarMsgId(null);
      prevMessageCountRef.current = 0;
      return;
    }
    const assistantMessages = messages.filter(
      (m) => m.role === "assistant" && m.grammarCheck
    );
    if (assistantMessages.length > 0) {
      const latest = assistantMessages[assistantMessages.length - 1];
      if (latest.grammarCheck) {
        setLatestCheck(latest.grammarCheck);
        const idx = messages.indexOf(latest);
        if (idx > 0 && messages[idx - 1].role === "user") {
          setLatestUserMessage(messages[idx - 1].content);
        }
        if (messages.length > prevMessageCountRef.current) {
          setSelectedGrammarMsgId(null);
        }
      }
    }
    prevMessageCountRef.current = messages.length;
  }, [messages]);

  useEffect(() => {
    setLatestCheck(null);
    setLatestUserMessage("");
    setSelectedGrammarMsgId(null);
    prevMessageCountRef.current = 0;
  }, [activeThreadId]);

  const displayedPair: { check: AIResponse["grammar_check"]; userMessage: string } | null =
    (() => {
      if (selectedGrammarMsgId !== null) {
        const idx = messages.findIndex((m) => m.id === selectedGrammarMsgId);
        if (idx !== -1) {
          const nextMsg = messages[idx + 1];
          if (nextMsg?.role === "assistant" && nextMsg.grammarCheck) {
            return { check: nextMsg.grammarCheck, userMessage: messages[idx].content };
          }
        }
      }
      return latestCheck ? { check: latestCheck, userMessage: latestUserMessage } : null;
    })();

  useEffect(() => {
    try {
      const saved = localStorage.getItem("grammar-check-lang");
      if (saved === "en" || saved === "es") setExplanationLang(saved);
    } catch {}
  }, []);

  const handleLangChange = (lang: "ja" | "en" | "es") => {
    setExplanationLang(lang);
    try { localStorage.setItem("grammar-check-lang", lang); } catch {}
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputValue.trim() || isLoading) return;
    const text = inputValue;
    setInputValue("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    await sendMessage(text);
    if (activeThreadId) await touchThread(activeThreadId);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      // Desktop (640px+) only: Enter sends; on mobile Enter adds a new line
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

  if (isStarting || isSwitchingLanguage) {
    return <FullScreenLoader />;
  }

  return (
    <div className="flex h-[var(--app-height)] bg-[var(--bg-base)] font-sans overflow-hidden">

      {/* ===== Settings modal ===== */}
      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        colorMode={colorMode}
        onColorModeChange={setColorMode}
        profile={profile}
        onUserAvatarChange={updateUserAvatar}
        isResizingAvatar={isResizingAvatar}
        provider={provider}
        onProviderChange={setProvider}
        lang={explanationLang}
        onLangChange={handleLangChange}
      />

      {/* ===== Sidebar ===== */}
      <Sidebar
        threads={threads}
        activeThreadId={activeThreadId}
        isOpen={sidebarOpen}
        deletingThreadId={deletingThreadId}
        isVocabLoading={isVocabLoading}
        lemmatizingIds={lemmatizingIds}
        onToggle={() => setSidebarOpen((v) => !v)}
        onNewChat={handleNewChat}
        isCreatingThread={isCreatingThread}
        onSelectThread={selectThread}
        onDeleteThread={deleteThread}
        onOpenSettings={() => setSettingsOpen(true)}
        language={language}
        vocabularyEntries={vocabEntries}
        onDeleteVocabulary={deleteVocabEntry}
      />

      {/* ===== Left: Chat area ===== */}
      <div className="flex flex-col flex-1 min-w-0 border-r border-white/5 z-10 bg-[var(--bg-base)] overflow-hidden">

        {/* Header & status */}
        <div className="flex-shrink-0 z-40 flex flex-col border-b border-white/5 bg-[var(--bg-base)]/85 backdrop-blur-xl shadow-sm">
          <div className="flex items-center justify-between px-4 py-3.5">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen((v) => !v)}
              className="p-1.5 rounded-lg text-[var(--text-dim)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] transition-colors"
              title={sidebarOpen ? "Close sidebar" : "Open sidebar"}
            >
              <Menu size={16} strokeWidth={1.8} />
            </button>

            {/* AI avatar */}
            <div className="relative">
              <Avatar
                src={characterAvatarSrc}
                alt={aiName}
                className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold shadow-lg shadow-violet-500/20"
              >
                {aiName[0]?.toUpperCase() ?? "R"}
              </Avatar>
            </div>
            <div className="flex items-center gap-2">
              <div>
                <p className="text-white text-sm font-semibold leading-none">{aiName}</p>
                <p className="text-[var(--text-muted)] text-xs mt-0.5">{langConfig.tutorSubtitle}</p>
              </div>
              {/* Language switch dropdown: self-stretch to span both text rows */}
              <div ref={langDropdownRef} className="relative self-stretch flex items-center">
                <button
                  onClick={() => setLangDropdownOpen((v) => !v)}
                  className="flex items-center gap-1 px-1.5 h-full rounded hover:bg-white/10 transition-colors"
                  title="Switch language"
                >
                  <img src={langConfig.flagSrc} alt={langConfig.nativeName} className="h-4 w-[22px] object-cover rounded-sm" />
                  <ChevronDown
                    size={12}
                    strokeWidth={2}
                    className={`text-[var(--text-dim)] transition-transform duration-150 ${langDropdownOpen ? "rotate-180" : ""}`}
                  />
                </button>
                {langDropdownOpen && (
                  <div className="absolute left-0 top-full mt-1 z-50 min-w-[130px] rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] shadow-xl overflow-hidden">
                    {LANGUAGE_LIST.map((lang) => (
                      <button
                        key={lang.code}
                        onClick={() => handleSwitchLanguage(lang.code)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors
                          ${lang.code === language
                            ? "bg-[var(--accent-10)] text-[var(--accent-text)]"
                            : "text-[var(--text-secondary)] hover:bg-[var(--bg-base)]"
                          }`}
                      >
                        <img src={lang.flagSrc} alt={lang.nativeName} className="h-3.5 w-5 object-cover rounded-sm flex-shrink-0" />
                        <span className="text-xs font-medium">{lang.nativeName}</span>
                        {lang.code === language && (
                          <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[var(--accent)] flex-shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Grammar learning mode button */}
            <GrammarModeToggle />

            {/* Grammar Check toggle — mobile only */}
            <button
              onClick={() => setGrammarOpen((v) => !v)}
              className="lg:hidden p-1.5 rounded-lg text-[var(--text-dim)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] transition-colors"
              title="Grammar Check"
            >
              <CircleCheck size={16} strokeWidth={2} />
            </button>

            <button
              onClick={handleNewChat}
              disabled={isCreatingThread}
              className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors p-1.5 rounded-lg hover:bg-[var(--bg-elevated)] disabled:opacity-60"
              title="New Chat"
            >
              <SquarePen size={16} strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {/* Model status bar */}
        {activeModelId && (
          <div className="px-5 py-1.5 bg-[var(--bg-deep)]/85 backdrop-blur-md border-t border-white/5 flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${isLoading ? "bg-amber-400 animate-pulse" : "bg-emerald-400"}`} />
            <span className="text-[10px] text-[var(--text-dim)] font-mono">{activeModelId}</span>
            {usedFallback && (
              <span className="text-[10px] text-amber-500/70 font-medium">fallback</span>
            )}
          </div>
        )}
        </div>

        {/* Message list */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-5 py-6 space-y-5 relative z-0 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-[var(--scrollbar-thumb)]">
          {isLoadingMessages ? (
            <div className="flex h-full items-center justify-center">
              <Spinner />
            </div>
          ) : (<>
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-4 py-16">
              <div className="w-16 h-16 rounded-2xl bg-[var(--accent-10)] border border-[var(--accent-border)] overflow-hidden flex items-center justify-center">
                <img src={langConfig.flagSrc} alt={langConfig.nativeName} className="w-12 h-9 object-cover rounded" />
              </div>
              {/* The picker is only for a chat the user is expected to start.
                  Practice threads (?topic=) have the AI speak first, so it stays
                  hidden there — including before the query params have been read
                  and while the greeting is in flight, or it would flash. */}
              {paramsRead && !topicFocus && !isLoading ? (
                <CharacterPicker
                  language={language}
                  selectedId={activeThreadId ? activeCharacter.id : lastCharacterId}
                  onSelect={handleSelectCharacter}
                  disabled={isCreatingThread || isSwitchingLanguage}
                />
              ) : (
                <div className="text-center">
                  <p className="text-white text-base font-medium mb-1">{langConfig.greeting} Soy {aiName}</p>
                  <p className="text-[var(--text-muted)] text-sm">Start chatting in {langConfig.nativeName}</p>
                </div>
              )}
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex items-end gap-2.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {/* AI avatar */}
              {msg.role === "assistant" && (
                <Avatar
                  src={characterAvatarSrc}
                  alt={aiName}
                  className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mb-0.5 shadow-md shadow-violet-500/20"
                >
                  {aiName[0]?.toUpperCase() ?? "R"}
                </Avatar>
              )}

              <div className="max-w-[75%] space-y-1.5">
                {/* Message bubble */}
                <div
                  className={`px-4 py-3 text-[15px] leading-relaxed ${
                    msg.role === "user"
                      ? "bg-[var(--user-bubble)] text-white rounded-[18px] rounded-br-[5px]"
                      : "bg-[var(--bg-surface)] text-[var(--text-primary)] rounded-[18px] rounded-bl-[5px] prose-message"
                  }`}
                >
                  {msg.role === "user" ? (
                    msg.content
                  ) : (
                    <MarkdownMessage content={msg.content} theme="default" />
                  )}
                </div>

                {/* Translation button + model display */}
                {msg.role === "assistant" && (
                  <div className="flex items-center justify-between gap-3 px-1">
                    <button
                      onClick={() => translateMessage(msg.id, msg.content, explanationLang)}
                      disabled={msg.isTranslating}
                      className="text-[11px] text-[var(--text-dim)] hover:text-[var(--accent-text)] transition-colors flex items-center gap-1 disabled:opacity-40"
                    >
                      <span>🌐</span>
                      <span>{msg.isTranslating ? "Translating…" : "Translation"}</span>
                    </button>
                    {msg.usedModel && (
                      <span className="text-[10px] text-[var(--text-xdim)] font-mono flex items-center gap-1.5">
                        {msg.stage && (
                          <span className={`px-1 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wide ${
                            msg.stage === "primary"   ? "bg-emerald-500/10 text-emerald-500/70" :
                            msg.stage === "secondary" ? "bg-amber-500/10 text-amber-500/70" :
                                                        "bg-[var(--accent-10)] text-[var(--accent-text)]/70"
                          }`}>
                            {msg.stage}
                          </span>
                        )}
                        {msg.usedFallback && !msg.stage && (
                          <span className="text-amber-600/60">fallback</span>
                        )}
                        <span>{msg.usedModel.split("/").pop()}</span>
                      </span>
                    )}
                  </div>
                )}

                {/* Translation result */}
                {msg.translatedText && (
                  <div className="px-3 py-2 bg-[var(--bg-surface)]/50 rounded-xl border border-[var(--border)]/50">
                    <p className="text-[11px] text-[var(--text-muted)] italic leading-relaxed">
                      {msg.translatedText}
                    </p>
                  </div>
                )}

                {/* Grammar status button — user messages only */}
                {msg.role === "user" && (() => {
                  const idx = messages.findIndex((m) => m.id === msg.id);
                  const nextMsg = messages[idx + 1];
                  const gc = nextMsg?.role === "assistant" ? nextMsg.grammarCheck : null;
                  if (!gc) return null;

                  const status = getGrammarStatus(gc);
                  const isActive = selectedGrammarMsgId === msg.id;

                  const colors = {
                    error:   { dot: "bg-red-400",     text: "text-red-400 hover:text-red-300",         label: "Error"   },
                    advice:  { dot: "bg-amber-400",   text: "text-amber-400 hover:text-amber-300",     label: "Tip"     },
                    perfect: { dot: "bg-emerald-400", text: "text-emerald-400 hover:text-emerald-300", label: "Perfect" },
                  }[status];

                  return (
                    <div className="flex justify-end px-1">
                      <button
                        onClick={() => {
                          setSelectedGrammarMsgId(isActive ? null : msg.id);
                          if (!grammarOpen) setGrammarOpen(true);
                        }}
                        className={`text-[11px] flex items-center gap-1 transition-all ${colors.text} ${
                          isActive ? "opacity-100" : "opacity-50 hover:opacity-100"
                        }`}
                        title="View grammar check"
                      >
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${colors.dot}`} />
                        <span>{colors.label}</span>
                      </button>
                    </div>
                  );
                })()}
              </div>

              {/* User avatar */}
              {msg.role === "user" && (
                <Avatar
                  src={profile.userAvatar}
                  alt="You"
                  className="w-7 h-7 rounded-full bg-[var(--bg-elevated)] flex items-center justify-center text-[var(--text-secondary)] text-xs font-bold flex-shrink-0 mb-0.5"
                >
                  K
                </Avatar>
              )}
            </div>
          ))}

          {/* Typing indicator */}
          {isLoading && (
            <div className="flex items-end gap-2.5">
              <Avatar
                src={characterAvatarSrc}
                alt={aiName}
                className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
              >
                {aiName[0]?.toUpperCase() ?? "R"}
              </Avatar>
              <div className="bg-[var(--bg-surface)] border border-[var(--border)] px-4 py-3.5 rounded-2xl rounded-bl-md">
                <div className="flex gap-1.5 items-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent-muted)] animate-bounce [animation-delay:0ms]" />
                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent-muted)] animate-bounce [animation-delay:150ms]" />
                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent-muted)] animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-4 py-3 rounded-xl flex items-start gap-2">
              <span className="mt-0.5">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <div ref={messagesEndRef} />
          </>)}
        </div>

        {/* Input area */}
        <div ref={inputBarRef} className="flex-shrink-0 z-40 px-4 py-3.5 border-t border-white/5 bg-[var(--bg-base)]/85 backdrop-blur-xl">
          <form
            onSubmit={handleSubmit}
            className="flex gap-2.5 items-end bg-[var(--bg-elevated)] border border-[var(--border)] rounded-3xl px-4 py-2.5 focus-within:border-[var(--accent-border-focus)] transition-colors relative z-10 overflow-hidden"
          >
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={langConfig.placeholder}
              rows={1}
              className="flex-1 min-w-0 resize-none bg-transparent text-[var(--text-primary)] text-sm placeholder-[var(--text-xdim)]
                         focus:outline-none leading-relaxed max-h-32 overflow-y-auto"
            />
            <button
              type="submit"
              disabled={isLoading || !inputValue.trim()}
              className={`w-8 h-8 rounded-full disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center justify-center flex-shrink-0 active:scale-95 ${
                theme === "espanol"
                  ? "bg-[#FFD700] hover:bg-[#e6c200]"
                  : "bg-[var(--accent)] hover:bg-[var(--accent-hover)]"
              }`}
            >
              <ArrowRight size={14} strokeWidth={2.5} className={theme === "espanol" ? "text-[#1a1a1a]" : "text-[var(--accent-fg)]"} />
            </button>
          </form>
          <p className="hidden sm:block text-[10px] text-[var(--text-xdim)] text-center mt-2">
            Enter to send  ·  Shift+Enter for new line
          </p>
        </div>
      </div>

      {/* ===== Vocabulary popup ===== */}
      <VocabularyPopup
        sourceLang={langConfig.code}
        targetLang="en"
        onAdd={addVocabEntry}
        inputBarRef={inputBarRef}
      />

      {/* ===== Grammar backdrop (mobile) ===== */}
      {grammarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setGrammarOpen(false)}
        />
      )}

      {/* ===== Right: Grammar panel ===== */}
      <div className={`
        flex-shrink-0 flex flex-col bg-[var(--bg-sidebar)]/85 backdrop-blur-xl border-l border-white/5 ring-1 ring-inset ring-white/5 shadow-xl
        fixed inset-y-0 right-0 z-50 w-[min(320px,90vw)]
        lg:relative lg:inset-auto lg:z-20 lg:w-72
        transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]
        ${grammarOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0"}
      `}>
        <div className="px-5 py-4 border-b border-white/5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-md bg-amber-500/20 flex items-center justify-center">
                <SquarePen size={12} strokeWidth={2} className="text-amber-400" />
              </div>
              <h2 className="text-white text-sm font-semibold">Grammar Check</h2>
            </div>
            <div className="flex items-center gap-1.5">
              {/* Close button — mobile only */}
              <button
                onClick={() => setGrammarOpen(false)}
                className="lg:hidden p-1.5 rounded-lg text-[var(--text-dim)] hover:text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] transition-colors"
              >
                <X size={16} strokeWidth={2} />
              </button>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-hidden">
          <GrammarPanel
            displayedCheck={displayedPair?.check ?? null}
            displayedUserMessage={displayedPair?.userMessage ?? ""}
          />
        </div>
      </div>

    </div>
  );
}
