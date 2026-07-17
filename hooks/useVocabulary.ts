"use client";

import { useState, useEffect } from "react";
import type { VocabularyEntry } from "@/lib/db/vocabulary";

export function useVocabulary(
  activeThreadId: string | null,
  activeThreadTitle: string
) {
  const [entries, setEntries]               = useState<VocabularyEntry[]>([]);
  const [isLoading, setIsLoading]           = useState(true);
  const [lemmatizingIds, setLemmatizingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("/api/vocabulary")
      .then((r) => {
        if (!r.ok) throw new Error(`vocabulary GET ${r.status}`);
        return r.json();
      })
      .then((data) => { setEntries(Array.isArray(data) ? data : []); setIsLoading(false); })
      .catch((err) => { console.error(err); setEntries([]); setIsLoading(false); });
  }, []);

  const addEntry = async (
    term: string,
    translation: string,
    sourceLang: string,
    targetLang: string
  ) => {
    // 1. Optimistic add (temporary entry)
    const tempId = `temp-${Date.now()}`;
    const tempEntry: VocabularyEntry = {
      id: tempId,
      term,
      translation,
      sourceLang,
      targetLang,
      threadId: activeThreadId ?? undefined,
      threadTitle: activeThreadTitle,
      createdAt: new Date().toISOString(),
    };
    setEntries((prev) => [tempEntry, ...prev]);

    try {
      // 2. Save to DB
      const res = await fetch("/api/vocabulary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          term,
          translation,
          sourceLang,
          targetLang,
          threadId: activeThreadId,
          threadTitle: activeThreadTitle,
        }),
      });
      if (!res.ok) throw new Error("Failed to save vocabulary");
      const saved: VocabularyEntry = await res.json();

      // Replace temp entry with real entry
      setEntries((prev) => prev.map((e) => (e.id === tempId ? saved : e)));

      // 3. Async: determine type and lemmatize
      const trimmed = term.trim();
      const words = trimmed.split(/\s+/);
      const isPhrase = words.length >= 2;
      console.log("[vocab:debug] term=", JSON.stringify(term), "trimmed=", JSON.stringify(trimmed), "words=", words, "isPhrase=", isPhrase, "saved.id=", saved.id);

      setLemmatizingIds((prev) => new Set(prev).add(saved.id));
      (async () => {
        try {
          if (isPhrase) {
            // Phrases do not need AI — record type="phrase" only
            const patchBody = { baseTerm: trimmed, partOfSpeech: null, translation, type: "phrase" };
            console.log("[vocab:debug] sending phrase PATCH", `/api/vocabulary/${saved.id}`, patchBody);
            const patchRes = await fetch(`/api/vocabulary/${saved.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(patchBody),
            });
            const patchText = await patchRes.text();
            console.log("[vocab:debug] phrase PATCH response", patchRes.status, patchText);
            if (!patchRes.ok) {
              console.error("[useVocabulary] phrase PATCH failed", patchRes.status, patchText);
              return;
            }
            setEntries((prev) =>
              prev.map((e) => (e.id === saved.id ? { ...e, type: "phrase" } : e))
            );
            return;
          }

          // Word: lemmatize + get type
          const normRes = await fetch("/api/word-normalize", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ term, sourceLang }),
          });
          if (!normRes.ok) return;
          const { baseTerm, type: vocabType, partOfSpeech } = await normRes.json();
          if (!baseTerm) return;

          let finalTranslation = translation;
          if (baseTerm !== term) {
            const transRes = await fetch("/api/word-translate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ term: baseTerm, sourceLang, targetLang }),
            });
            if (transRes.ok) {
              const { translation: baseTranslation } = await transRes.json();
              if (baseTranslation) finalTranslation = baseTranslation;
            }
          }

          const wordPatchRes = await fetch(`/api/vocabulary/${saved.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              baseTerm,
              partOfSpeech: partOfSpeech ?? null,
              translation: finalTranslation,
              type: vocabType ?? "word",
            }),
          });
          if (!wordPatchRes.ok) {
            const errBody = await wordPatchRes.text();
            console.error("[useVocabulary] word PATCH failed", wordPatchRes.status, errBody);
            return;
          }

          setEntries((prev) =>
            prev.map((e) =>
              e.id === saved.id
                ? {
                    ...e,
                    term:         baseTerm,
                    translation:  finalTranslation,
                    type:         vocabType ?? "word",
                    partOfSpeech: partOfSpeech ?? undefined,
                  }
                : e
            )
          );
        } catch (err) {
          console.error("[useVocabulary] normalize/patch error", err);
        } finally {
          setLemmatizingIds((prev) => {
            const s = new Set(prev);
            s.delete(saved.id);
            return s;
          });
        }
      })();
    } catch {
      // Remove temporary entry if save fails
      setEntries((prev) => prev.filter((e) => e.id !== tempId));
    }
  };

  const deleteEntry = async (id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id)); // optimistic delete
    await fetch(`/api/vocabulary/${id}`, { method: "DELETE" }).catch(console.error);
  };

  return { entries, addEntry, deleteEntry, isLoading, lemmatizingIds };
}
