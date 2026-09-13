"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { putThread } from "@/lib/db-client";
import { readLastCharacterId } from "@/lib/character-preference";
import { Spinner } from "@/components/ui/Spinner";

interface ErrorEntry {
  category: string;
  count:    number;
}

interface PracticeExample {
  id:          string;
  original:    string;
  corrected:   string;
  explanation: string;
  created_at:  number;
}

interface PracticeModal {
  category: string;
  examples: PracticeExample[];
}

interface ErrorInsightsProps {
  language: string;
}

export function ErrorInsights({ language }: ErrorInsightsProps) {
  const [errors, setErrors]           = useState<ErrorEntry[]>([]);
  const [loading, setLoading]         = useState(true);
  const [fetchingCategory, setFetchingCategory] = useState<string | null>(null);
  const [starting, setStarting]       = useState(false);
  const [practiceModal, setPracticeModal] = useState<PracticeModal | null>(null);
  const router = useRouter();

  useEffect(() => {
    setLoading(true);
    fetch(`/api/dashboard/errors?language=${language}&limit=20`)
      .then((r) => { if (!r.ok) throw new Error(`errors ${r.status}`); return r.json(); })
      .then((d) => { setErrors(Array.isArray(d) ? (d as ErrorEntry[]) : []); setLoading(false); })
      .catch((e) => { console.error(e); setErrors([]); setLoading(false); });
  }, [language]);

  const handlePracticeClick = async (category: string) => {
    if (fetchingCategory) return;
    setFetchingCategory(category);
    try {
      const res = await fetch(
        `/api/dashboard/errors/${encodeURIComponent(category)}/messages?language=${language}&limit=5`
      );
      const { examples } = (await res.json()) as { examples: PracticeExample[] };
      setPracticeModal({ category, examples: examples ?? [] });
    } catch {
      setPracticeModal({ category, examples: [] });
    } finally {
      setFetchingCategory(null);
    }
  };

  const handleStartPractice = async () => {
    if (!practiceModal || starting) return;
    setStarting(true);
    const { category, examples } = practiceModal;
    try {
      const now = Date.now();
      const id  = now.toString(36) + Math.random().toString(36).slice(2);
      await putThread({
        id,
        title:           `Practice: ${category}`,
        lastUpdatedAt:   now,
        createdAt:       now,
        type:            "chat",
        grammarTopicId:  null,
        grammarLevel:    null,
        grammarUnitName: null,
        completed:       false,
        score:           null,
        language,
        // The picker is skipped for practice threads (the AI speaks first), so
        // inherit the last selected character.
        characterId:     readLastCharacterId(),
      });
      const encodedExamples = encodeURIComponent(JSON.stringify(examples));
      router.push(
        `/?threadId=${encodeURIComponent(id)}&topic=${encodeURIComponent(category)}&examples=${encodedExamples}`
      );
    } catch {
      router.push(`/?topic=${encodeURIComponent(category)}`);
    } finally {
      setStarting(false);
      setPracticeModal(null);
    }
  };

  const maxCount = errors[0]?.count ?? 1;

  return (
    <>
      <div className="bg-[var(--bg-surface)] rounded-2xl p-5">
        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-amber-400 text-sm">⚠</span>
          <p className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-widest">
            Error Insights
          </p>
        </div>

        {loading ? (
          <div className="h-[360px] flex items-center justify-center">
            <Spinner />
          </div>
        ) : errors.length === 0 ? (
          <div className="h-[360px] flex items-center justify-center text-[var(--text-muted)] text-sm">
            No errors recorded yet
          </div>
        ) : (
          <div className="h-[360px] overflow-y-auto pr-1 space-y-1.5">
            {errors.map((entry, index) => {
              const barPct = Math.round((entry.count / maxCount) * 100);
              const isFetching = fetchingCategory === entry.category;
              return (
                <div
                  key={entry.category}
                  className="flex items-center gap-2 bg-[var(--bg-elevated)] rounded-xl px-3 py-2.5"
                >
                  <span className="text-[11px] font-bold text-[var(--text-dim)] w-5 text-right flex-shrink-0">
                    {index + 1}.
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-[var(--text-primary)] truncate">
                      {entry.category}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-1.5 bg-[var(--bg-deep)] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-amber-400 rounded-full transition-all"
                          style={{ width: `${barPct}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-[var(--text-muted)] whitespace-nowrap flex-shrink-0">
                        {entry.count}×
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handlePracticeClick(entry.category)}
                    disabled={!!fetchingCategory}
                    className="px-2.5 py-1 bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg text-[10px] font-semibold text-[var(--text-primary)] hover:border-[var(--accent-border)] hover:text-[var(--accent-text)] transition-colors whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                  >
                    {isFetching ? "…" : "Practice"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Practice confirm modal */}
      {practiceModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <p className="text-sm font-bold text-[var(--text-primary)]">
              Start practice: {practiceModal.category}
            </p>

            {practiceModal.examples.length > 0 ? (
              <>
                <p className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-widest">
                  Past errors
                </p>
                <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
                  {practiceModal.examples.map((ex, i) => (
                    <div key={ex.id} className="text-xs space-y-1">
                      <p className="text-[var(--text-dim)] font-medium">{i + 1}.</p>
                      <p className="text-red-400">✗ &ldquo;{ex.original}&rdquo;</p>
                      <p className="text-green-400">✓ &ldquo;{ex.corrected}&rdquo;</p>
                      {ex.explanation && (
                        <p className="text-[var(--text-muted)] pl-2">→ {ex.explanation}</p>
                      )}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-xs text-[var(--text-muted)]">
                No past errors yet. Learn patterns through practice.
              </p>
            )}

            <div className="flex gap-3 pt-1">
              <button
                onClick={handleStartPractice}
                disabled={starting}
                className="flex-1 px-4 py-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {starting ? "Loading…" : "Start practice with this content"}
              </button>
              <button
                onClick={() => setPracticeModal(null)}
                disabled={starting}
                className="px-4 py-2 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
