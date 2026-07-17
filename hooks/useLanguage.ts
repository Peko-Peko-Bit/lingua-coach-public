"use client";

import { useSyncExternalStore } from "react";
import { DEFAULT_LANGUAGE, LANGUAGES, type LanguageCode, type LanguageMeta } from "@/lib/languages";

const STORAGE_KEY = "language";
const listeners = new Set<() => void>();

function readLanguage(): LanguageCode {
  if (typeof window === "undefined") return DEFAULT_LANGUAGE;
  const stored = localStorage.getItem(STORAGE_KEY) as LanguageCode | null;
  return stored && LANGUAGES[stored] ? stored : DEFAULT_LANGUAGE;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

export function useLanguage() {
  // useSyncExternalStore keeps the server snapshot (DEFAULT_LANGUAGE) and the
  // client's localStorage value consistent without a hydration mismatch.
  const language = useSyncExternalStore(subscribe, readLanguage, () => DEFAULT_LANGUAGE);

  const setLanguage = (code: LanguageCode) => {
    localStorage.setItem(STORAGE_KEY, code);
    // localStorage writes don't fire "storage" in the same tab — notify manually.
    listeners.forEach((l) => l());
  };

  const langConfig: LanguageMeta = LANGUAGES[language];

  return { language, setLanguage, langConfig };
}
