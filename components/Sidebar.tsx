"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronsLeft, MessageCircleMore, BookOpen, SquarePen, Loader2, Trash2, Settings2 } from "lucide-react";
import type { ThreadRecord } from "@/lib/db";
import type { VocabularyEntry } from "@/lib/db/vocabulary";
import { VocabularyPanel } from "./VocabularyPanel";
import { UserAuthSection } from "@/components/auth/UserAuthSection";

type SidebarTab = "chats" | "vocabulary";

interface SidebarProps {
  threads:              ThreadRecord[];
  activeThreadId:       string | null;
  isOpen:               boolean;
  deletingThreadId:     string | null;
  isVocabLoading:       boolean;
  lemmatizingIds:       Set<string>;
  onToggle:             () => void;
  onNewChat:            () => void;
  onSelectThread:       (id: string) => void;
  onDeleteThread:       (id: string) => void;
  onOpenSettings:       () => void;
  language:             string;
  vocabularyEntries:    VocabularyEntry[];
  onDeleteVocabulary:   (id: string) => void;
  isCreatingThread?:    boolean;
}

export function Sidebar({
  threads,
  activeThreadId,
  isOpen,
  deletingThreadId,
  isVocabLoading,
  lemmatizingIds,
  onToggle,
  onNewChat,
  onSelectThread,
  onDeleteThread,
  onOpenSettings,
  language,
  vocabularyEntries,
  onDeleteVocabulary,
  isCreatingThread = false,
}: SidebarProps) {
  const [activeTab, setActiveTab] = useState<SidebarTab>("chats");

  const filteredThreads = threads.filter((t) => t.language === language);
  const filteredVocabulary = vocabularyEntries.filter((e) => e.sourceLang === language);

  return (
    <>
      {/* ---- Mobile backdrop ---- */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onToggle}
        />
      )}

      {/* ---- Sidebar body ---- */}
      <aside
        className={`
          flex-shrink-0 flex flex-col bg-[var(--bg-sidebar)]/85 backdrop-blur-xl border-r border-white/5 ring-1 ring-inset ring-white/5
          overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]
          fixed inset-y-0 left-0 z-50 w-72
          lg:relative lg:inset-auto lg:z-30
          ${isOpen
            ? "translate-x-0 lg:w-60"
            : "-translate-x-full lg:w-0 lg:translate-x-0"
          }
        `}
      >
        {/* Header: title + close button */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/5">
          <span className="text-[var(--text-secondary)] text-xs font-semibold uppercase tracking-widest whitespace-nowrap">
            {activeTab === "chats" ? "Chats" : "Vocabulary"}
          </span>
          <button
            onClick={onToggle}
            className="p-1.5 rounded-lg text-[var(--text-dim)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
            title="Close sidebar"
          >
            <ChevronsLeft size={16} strokeWidth={1.8} />
          </button>
        </div>

        {/* ---- Tab bar ---- */}
        <div className="flex px-2 pt-2 pb-1 gap-1">
          <button
            onClick={() => setActiveTab("chats")}
            className={`flex items-center gap-1.5 flex-1 justify-center px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "chats"
                ? "bg-[var(--accent-10)] border border-[var(--accent-border)] text-[var(--accent-text)]"
                : "text-[var(--text-muted)] hover:bg-[var(--bg-elevated)]"
            }`}
          >
            <MessageCircleMore size={14} strokeWidth={1.8} />
            Chats
          </button>
          <button
            onClick={() => setActiveTab("vocabulary")}
            className={`flex items-center gap-1.5 flex-1 justify-center px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "vocabulary"
                ? "bg-[var(--accent-10)] border border-[var(--accent-border)] text-[var(--accent-text)]"
                : "text-[var(--text-muted)] hover:bg-[var(--bg-elevated)]"
            }`}
          >
            <BookOpen size={14} strokeWidth={1.8} />
            Vocabulary
            {vocabularyEntries.length > 0 && (
              <span className="px-1 py-0.5 rounded text-[10px] bg-[var(--accent-10)] text-[var(--accent-text)]">
                {vocabularyEntries.length}
              </span>
            )}
          </button>
        </div>

        {/* ---- Chats tab ---- */}
        {activeTab === "chats" && (
          <>
            {/* New Chat button */}
            <div className="px-3 py-2">
              <button
                onClick={onNewChat}
                disabled={isCreatingThread}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl
                           bg-[var(--accent-10)] border border-[var(--accent-border)] text-[var(--accent-text)]
                           hover:bg-[var(--accent-15)] hover:border-[var(--accent-border-hover)] hover:shadow-[0_0_15px_rgba(var(--accent-rgb),0.15)]
                           transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] text-sm font-medium whitespace-nowrap
                           disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isCreatingThread
                  ? <Loader2 size={16} className="animate-spin flex-shrink-0" />
                  : <SquarePen size={16} strokeWidth={1.8} className="flex-shrink-0" />
                }
                New Chat
              </button>
            </div>

            {/* Thread list */}
            <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-0.5
                            scrollbar-thin scrollbar-track-transparent scrollbar-thumb-[var(--scrollbar-thumb)]">
              {filteredThreads.length === 0 && (
                <p className="text-[var(--text-dim)] text-xs text-center px-4 pt-4">
                  No conversations yet
                </p>
              )}

              {filteredThreads.map((thread) => {
                const isActive = thread.id === activeThreadId;
                return (
                  <div
                    key={thread.id}
                    onClick={() => onSelectThread(thread.id)}
                    className={`
                      group flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer
                      transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] select-none
                      ${isActive
                        ? "bg-[var(--accent)] text-white"
                        : "text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
                      }
                    `}
                  >
                    <MessageCircleMore
                      size={14}
                      strokeWidth={1.8}
                      className={`flex-shrink-0 ${isActive ? "text-white" : "text-[var(--text-dim)]"}`}
                    />
                    <span className="flex-1 text-xs truncate">{thread.title}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteThread(thread.id);
                      }}
                      disabled={deletingThreadId === thread.id}
                      className={`p-1 rounded-lg text-[var(--text-dim)] transition-all duration-100
                                  hover:bg-red-500/20 hover:text-red-400
                                  disabled:cursor-not-allowed
                                  ${deletingThreadId === thread.id ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
                      title="Delete this thread"
                    >
                      {deletingThreadId === thread.id ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Trash2 size={14} strokeWidth={1.8} />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ---- Vocabulary tab ---- */}
        {activeTab === "vocabulary" && (
          <div className="flex-1 overflow-hidden">
            <VocabularyPanel
              entries={filteredVocabulary}
              onDelete={onDeleteVocabulary}
              isLoading={isVocabLoading}
              lemmatizingIds={lemmatizingIds}
            />
          </div>
        )}

        {/* ---- Footer: app nav ---- */}
        <div className="px-3 pt-3 border-t border-white/5 flex gap-1 flex-wrap">
          <Link href="/grammar" className="px-2.5 py-1 rounded-lg text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] transition-colors">Grammar</Link>
          <Link href="/dashboard" className="px-2.5 py-1 rounded-lg text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] transition-colors">Dashboard</Link>
          {process.env.NEXT_PUBLIC_LINGUAGYM_URL && (
            <a href={process.env.NEXT_PUBLIC_LINGUAGYM_URL} className="px-2.5 py-1 rounded-lg text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] transition-colors">LinguaGym ↗</a>
          )}
        </div>

        {/* ---- Footer: settings button ---- */}
        <div className="px-3 pb-2">
          <UserAuthSection />
        </div>

        <div className="px-3 py-3">
          <button
            onClick={onOpenSettings}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl
                       text-[var(--text-muted)] hover:text-[var(--text-secondary)]
                       hover:bg-[var(--bg-elevated)] transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
          >
            <Settings2 size={16} strokeWidth={1.8} className="flex-shrink-0" />
            <span className="text-xs font-medium whitespace-nowrap">Settings</span>
          </button>
        </div>
      </aside>
    </>
  );
}

