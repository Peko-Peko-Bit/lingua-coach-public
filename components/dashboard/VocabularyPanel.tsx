"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Loader2 } from "lucide-react";
import { Spinner } from "@/components/ui/Spinner";

interface VocabEntry {
  id:               string;
  term:             string;
  translation:      string;
  part_of_speech:   string | null;
  session_title:    string | null;
  source_app:       string | null;
  last_reviewed_at: string | null;
}

interface VocabularyPanelProps {
  language: string;
}

type TabType  = "word" | "phrase";
type SortMode = "recent" | "review";
type PosFilter = "" | "noun" | "verb" | "adjective" | "adverb" | "other";

const POS_STYLES: Record<string, string> = {
  noun:      "bg-blue-900/40 text-blue-300",
  verb:      "bg-red-900/40 text-red-300",
  adjective: "bg-green-900/40 text-green-300",
  adverb:    "bg-yellow-900/40 text-yellow-300",
  other:     "bg-gray-800 text-gray-400",
};

const POS_FILTERS: { label: string; value: PosFilter }[] = [
  { label: "All",  value: "" },
  { label: "Noun", value: "noun" },
  { label: "Verb", value: "verb" },
  { label: "Adj",  value: "adjective" },
  { label: "Adv",  value: "adverb" },
];

export function VocabularyPanel({ language }: VocabularyPanelProps) {
  const [tab, setTab]           = useState<TabType>("word");
  const [sort, setSort]         = useState<SortMode>("recent");
  const [pos, setPos]           = useState<PosFilter>("");
  const [search, setSearch]     = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [entries, setEntries]   = useState<VocabEntry[]>([]);
  const [loading, setLoading]       = useState(true);
  const [reviewed, setReviewed]     = useState<Set<string>>(new Set());
  const [inProgress, setInProgress] = useState<Set<string>>(new Set());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 300ms debounce for search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search]);

  // Reset pos filter when switching tabs
  useEffect(() => { setPos(""); setSearch(""); setDebouncedSearch(""); }, [tab]);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({
      language,
      sort,
      limit: "50",
      type: tab,
    });
    if (pos)            params.set("part_of_speech", pos);
    if (debouncedSearch) params.set("search", debouncedSearch);

    fetch(`/api/dashboard/vocabulary?${params}`)
      .then((r) => { if (!r.ok) throw new Error(`vocabulary ${r.status}`); return r.json(); })
      .then((d) => { setEntries(Array.isArray(d) ? (d as VocabEntry[]) : []); setLoading(false); })
      .catch((e) => { console.error(e); setEntries([]); setLoading(false); });
  }, [language, sort, tab, pos, debouncedSearch]);

  useEffect(() => { load(); }, [load]);

  const handleRowClick = async (id: string) => {
    if (reviewed.has(id) || inProgress.has(id)) return;
    setInProgress((prev) => new Set(prev).add(id));
    try {
      await fetch(`/api/dashboard/vocabulary/${id}`, { method: "PATCH" });
      setReviewed((prev) => new Set(prev).add(id));
    } catch {}
    finally {
      setInProgress((prev) => { const s = new Set(prev); s.delete(id); return s; });
    }
  };

  return (
    <div className="bg-[var(--bg-surface)] rounded-2xl p-5">
      {/* Tabs */}
      <div className="flex gap-0 border-b border-[var(--border)] mb-4">
        {(["word", "phrase"] as TabType[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`pb-2 px-4 text-sm font-semibold transition-colors -mb-px ${
              tab === t
                ? "text-[var(--accent-text)] border-b-2 border-[var(--accent)]"
                : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            }`}
          >
            {t === "word" ? "Words" : "Phrases"}
          </button>
        ))}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {/* POS filter (Words only) */}
        {tab === "word" && (
          <div className="flex gap-1">
            {POS_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setPos(f.value)}
                className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                  pos === f.value
                    ? "bg-[var(--accent)] text-white"
                    : "bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Sort */}
        <div className="flex gap-1">
          {(["recent", "review"] as SortMode[]).map((s) => (
            <button
              key={s}
              onClick={() => setSort(s)}
              className={`text-xs px-2 py-1 rounded-md transition-colors ${
                sort === s
                  ? "bg-[var(--bg-elevated)] text-[var(--text-primary)] font-semibold"
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              }`}
            >
              {s === "recent" ? "New" : "Review"}
            </button>
          ))}
        </div>
      </div>

      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={`Search ${tab === "word" ? "words" : "phrases"}…`}
        className="w-full mb-3 px-3 py-1.5 text-xs bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-dim)] outline-none focus:border-[var(--accent-border)] transition-colors"
      />

      {/* List */}
      {loading ? (
        <div className="h-40 flex items-center justify-center">
          <Spinner />
        </div>
      ) : entries.length === 0 ? (
        <div className="h-40 flex items-center justify-center text-[var(--text-muted)] text-sm">
          No {tab === "word" ? "words" : "phrases"} found
        </div>
      ) : (
        <div className="overflow-y-auto max-h-72 space-y-px">
          {entries.map((entry) => {
            const isReviewed = reviewed.has(entry.id);
            return (
              <div
                key={entry.id}
                onClick={() => handleRowClick(entry.id)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors group ${
                  isReviewed ? "opacity-50" : "hover:bg-[var(--bg-elevated)]"
                }`}
              >
                {/* Term + translation */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
                      {entry.term}
                    </p>
                    {tab === "word" && entry.part_of_speech && (
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium flex-shrink-0 ${POS_STYLES[entry.part_of_speech] ?? POS_STYLES.other}`}>
                        {entry.part_of_speech}
                      </span>
                    )}
                    {inProgress.has(entry.id) ? (
                      <Loader2 size={12} className="animate-spin text-[var(--text-muted)] flex-shrink-0" />
                    ) : isReviewed ? (
                      <span className="text-[10px] text-green-400 font-semibold flex-shrink-0">✓</span>
                    ) : null}
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] truncate mt-0.5">
                    {entry.translation}
                  </p>
                </div>

                {/* Session title */}
                {entry.session_title && (
                  <span className="text-[10px] text-[var(--text-dim)] truncate max-w-[120px] flex-shrink-0 hidden sm:block">
                    {entry.session_title}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-3 pt-3 border-t border-[var(--border)]">
        <button className="w-full text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors uppercase tracking-widest py-1">
          View All Vocabulary
        </button>
      </div>
    </div>
  );
}
