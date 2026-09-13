"use client";

/**
 * lib/character-preference.ts
 *
 * "Last selected character" — an internal preference, not a user-facing setting.
 *
 * A thread's character is fixed at creation (threads.character_id), so this
 * value only decides what is *pre-selected*:
 *   1. the CharacterPicker on the empty state of a new chat
 *   2. threads created without going through the picker (the dashboard's
 *      Practice button, where the AI speaks first)
 *
 * Mirrors the useSyncExternalStore pattern in hooks/useLanguage.ts so the
 * server snapshot and the client's localStorage value can't cause a hydration
 * mismatch.
 */

import { useSyncExternalStore } from "react";
import { CHARACTERS, DEFAULT_CHARACTER_ID } from "@/lib/characters";

// Key kept from the old Settings-based character picker so existing users keep
// their choice as the initial pre-selection.
const STORAGE_KEY = "profile_character_id";

const listeners = new Set<() => void>();

export function readLastCharacterId(): string {
  if (typeof window === "undefined") return DEFAULT_CHARACTER_ID;
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored && CHARACTERS.some((c) => c.id === stored) ? stored : DEFAULT_CHARACTER_ID;
}

export function writeLastCharacterId(id: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, id);
  // localStorage writes don't fire "storage" in the same tab — notify manually.
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

export function useLastCharacterId(): string {
  return useSyncExternalStore(subscribe, readLastCharacterId, () => DEFAULT_CHARACTER_ID);
}
