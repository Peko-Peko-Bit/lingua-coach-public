"use client";

import { BookOpen, Download, Loader2, Trash2 } from "lucide-react";
import type { VocabularyEntry } from "@/lib/db/vocabulary";

interface VocabularyPanelProps {
  entries: VocabularyEntry[];
  onDelete: (id: string) => void;
  isLoading?: boolean;
  lemmatizingIds?: Set<string>;
}

export function VocabularyPanel({ entries, onDelete, isLoading, lemmatizingIds }: VocabularyPanelProps) {
  const exportCsv = () => {
    const header = "term,translation,partOfSpeech,sourceLang,targetLang,threadTitle,createdAt";
    const rows = entries.map((e) =>
      [e.term, e.translation, e.partOfSpeech ?? "", e.sourceLang, e.targetLang, e.threadTitle, e.createdAt]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",")
    );
    const blob = new Blob([header + "\n" + rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vocabulary-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-shrink-0 px-3 py-2 border-b border-white/5">
          <div className="w-full h-8 rounded-xl bg-[var(--bg-elevated)] animate-pulse" />
        </div>
        <div className="px-2 pb-3 space-y-1 pt-1">
          {[70, 55, 80].map((w, i) => (
            <div key={i} className="flex items-start gap-2 px-3 py-2.5">
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 rounded bg-[var(--bg-elevated)] animate-pulse" style={{ width: `${w}%` }} />
                <div className="h-2.5 rounded bg-[var(--bg-elevated)] animate-pulse" style={{ width: `${Math.round(w * 0.7)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 px-6 py-12">
        <div className="w-10 h-10 rounded-full bg-[var(--bg-elevated)] flex items-center justify-center">
          <BookOpen size={20} strokeWidth={1.5} className="text-[var(--text-dim)]" />
        </div>
        <p className="text-[var(--text-muted)] text-sm text-center leading-relaxed">
          Select text during chat<br />to add to vocabulary
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Export button */}
      <div className="flex-shrink-0 px-3 py-2 border-b border-white/5">
        <button
          onClick={exportCsv}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl
                     text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-secondary)]
                     hover:bg-[var(--bg-elevated)] border border-[var(--border)] transition-all"
        >
          <Download size={14} strokeWidth={1.8} />
          Export CSV
        </button>
      </div>

      {/* Word list */}
      <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-1
                      scrollbar-thin scrollbar-track-transparent scrollbar-thumb-[var(--scrollbar-thumb)]">
        {entries.map((entry) => (
          <div
            key={entry.id}
            className="group flex items-start gap-2 px-3 py-2.5 rounded-xl
                       hover:bg-[var(--bg-elevated)] transition-all"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="text-[var(--text-primary)] text-sm font-medium truncate">
                  {entry.term}
                </span>
                {lemmatizingIds?.has(entry.id) ? (
                  <Loader2 size={10} className="animate-spin text-[var(--text-dim)] shrink-0" />
                ) : (
                  entry.partOfSpeech && (
                    <span className="text-[10px] text-[var(--text-dim)] shrink-0">{entry.partOfSpeech}</span>
                  )
                )}
              </div>
              <p className="text-[var(--text-muted)] text-xs truncate">{entry.translation}</p>
            </div>
            <button
              onClick={() => onDelete(entry.id)}
              className="opacity-0 group-hover:opacity-100 p-1 rounded-lg flex-shrink-0
                         hover:bg-red-500/20 hover:text-red-400 text-[var(--text-dim)]
                         transition-all duration-100"
              title="Delete"
            >
              <Trash2 size={14} strokeWidth={1.8} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
