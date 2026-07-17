"use client";

import { useState, useEffect, useCallback, useRef, RefObject } from "react";
import { BookOpen, Loader2 } from "lucide-react";

interface VocabularyPopupProps {
  sourceLang: string;
  targetLang: string;
  onAdd: (term: string, translation: string, sourceLang: string, targetLang: string) => void;
  inputBarRef?: RefObject<HTMLDivElement | null>;
}

export function VocabularyPopup({ sourceLang, targetLang, onAdd, inputBarRef }: VocabularyPopupProps) {
  const [popup, setPopup] = useState<{ text: string; x: number; y: number; isMobile: boolean } | null>(null);
  const [translation, setTranslation] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [bottomOffset, setBottomOffset] = useState(0);
  const selectionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const popupContainerRef = useRef<HTMLDivElement>(null);
  // Guard: skip re-fetch when selectionchange fires due to React updating the input value
  const currentTermRef = useRef<string | null>(null);

  // Track bottom position when keyboard opens via visualViewport
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      setBottomOffset(window.innerHeight - vv.height - vv.offsetTop);
    };
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  const fetchTranslation = useCallback(async (term: string, signal: AbortSignal) => {
    setIsLoading(true);
    setTranslation("");
    try {
      const res = await fetch("/api/word-translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ term, sourceLang, targetLang }),
        signal,
      });
      if (!res.ok) throw new Error("failed");
      const { translation: t } = await res.json();
      setTranslation(t ?? "");
    } catch {
      // aborted or network error — field stays empty for manual entry
    } finally {
      setIsLoading(false);
    }
  }, [sourceLang, targetLang]);

  const handleSelection = useCallback(() => {
    const sel = window.getSelection();
    const text = sel?.toString().trim() ?? "";

    // Only open the popup — closing is handled by outside mousedown
    if (!text || text.split(/\s+/).length > 6) return;

    // Skip if already fetching/showing this exact term (prevents selectionchange loop)
    if (text === currentTermRef.current) return;
    currentTermRef.current = text;

    const range = sel!.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const isMobile = navigator.maxTouchPoints > 0;
    setPopup({
      text,
      x: rect.left + rect.width / 2,
      y: rect.top - 8,
      isMobile,
    });

    abortRef.current?.abort();
    abortRef.current = new AbortController();
    fetchTranslation(text, abortRef.current.signal);
  }, [fetchTranslation]);

  // On mobile, selectionchange is reliable (touchend may fire before selection is confirmed)
  const handleSelectionChange = useCallback(() => {
    if (selectionTimerRef.current !== null) clearTimeout(selectionTimerRef.current);
    selectionTimerRef.current = setTimeout(() => {
      handleSelection();
      selectionTimerRef.current = null;
    }, 200);
  }, [handleSelection]);

  useEffect(() => {
    document.addEventListener("mouseup", handleSelection);
    document.addEventListener("selectionchange", handleSelectionChange);
    return () => {
      document.removeEventListener("mouseup", handleSelection);
      document.removeEventListener("selectionchange", handleSelectionChange);
      if (selectionTimerRef.current !== null) clearTimeout(selectionTimerRef.current);
    };
  }, [handleSelection, handleSelectionChange]);

  // Close on outside mousedown — lets the translation input receive focus without closing
  useEffect(() => {
    if (!popup) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (popupContainerRef.current && !popupContainerRef.current.contains(e.target as Node)) {
        currentTermRef.current = null;
        setPopup(null);
        abortRef.current?.abort();
      }
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [popup]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPopup(null);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleAdd = () => {
    if (!popup || isLoading) return;
    onAdd(popup.text, translation || popup.text, sourceLang, targetLang);
    currentTermRef.current = null;
    setPopup(null);
    window.getSelection()?.removeAllRanges();
  };

  if (!popup) return null;


  // Mobile: fixed card at bottom of screen (input + button side by side)
  if (popup.isMobile) {
    const inputBarHeight = inputBarRef?.current?.offsetHeight ?? 0;
    return (
      <div
        className="fixed left-3 right-3 z-[100] pointer-events-none transition-[bottom] duration-150"
        style={{ bottom: bottomOffset + inputBarHeight + 8 }}
      >
        <div
          ref={popupContainerRef}
          className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl shadow-xl p-2 flex items-center gap-2 pointer-events-auto"
        >
          <div className="flex-1 min-w-0">
            {isLoading ? (
              <div className="flex items-center gap-1.5 text-sm text-[var(--text-muted)] px-1 py-2">
                <Loader2 size={14} className="animate-spin shrink-0" />
                <span>Translating…</span>
              </div>
            ) : (
              <input
                value={translation}
                onChange={e => setTranslation(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleAdd(); }}
                placeholder="Translation…"
                className="w-full text-sm bg-[var(--bg-elevated)] rounded-lg px-2.5 py-2 outline-none focus:ring-1 focus:ring-[var(--accent)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
              />
            )}
          </div>
          <button
            onMouseDown={e => e.preventDefault()}
            onClick={handleAdd}
            disabled={isLoading}
            className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold bg-[var(--accent)] text-[var(--accent-fg)] hover:opacity-90 disabled:opacity-50 transition-all whitespace-nowrap"
          >
            <BookOpen size={14} strokeWidth={2} className="shrink-0" />
            Add to vocabulary
          </button>
        </div>
      </div>
    );
  }

  // Desktop: card above selected text
  const clampedX = Math.max(106, Math.min(popup.x, window.innerWidth - 106));

  return (
    <div
      className="fixed z-[100] -translate-x-1/2 -translate-y-full pointer-events-none"
      style={{ left: clampedX, top: popup.y }}
    >
      <div
        ref={popupContainerRef}
        className="relative bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl shadow-xl p-2.5 flex flex-col gap-2 w-52 pointer-events-auto"
      >
        {isLoading ? (
          <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] px-1 py-1">
            <Loader2 size={12} className="animate-spin shrink-0" />
            <span>Translating…</span>
          </div>
        ) : (
          <input
            value={translation}
            onChange={e => setTranslation(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleAdd(); }}
            placeholder="Translation…"
            className="w-full text-xs bg-[var(--bg-elevated)] rounded-lg px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-[var(--accent)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
          />
        )}
        <button
          onMouseDown={e => e.preventDefault()}
          onClick={handleAdd}
          disabled={isLoading}
          className="flex items-center justify-center gap-1.5 w-full px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--accent)] text-[var(--accent-fg)] hover:opacity-90 disabled:opacity-50 transition-all whitespace-nowrap"
        >
          <BookOpen size={12} strokeWidth={2} className="shrink-0" />
          Add to vocabulary
        </button>
        {/* Callout triangle — protruding from center bottom of card */}
        <div className="absolute left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2 w-3 h-3 bg-[var(--bg-surface)] border-r border-b border-[var(--border)] rotate-45" />
      </div>
    </div>
  );
}
