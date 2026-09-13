"use client";

/**
 * components/CharacterPicker.tsx
 *
 * Character selection for the empty state of a new chat.
 *
 * A thread's character is fixed once the first message is sent (it is stored on
 * the thread at creation), so this is the only place a character is chosen —
 * selecting one starts a fresh thread with it.
 */

import { Check } from "lucide-react";
import { charactersForLanguage } from "@/lib/characters";
import type { LanguageCode } from "@/lib/languages";

interface CharacterPickerProps {
  language:   LanguageCode;
  selectedId: string;
  onSelect:   (characterId: string) => void;
  disabled?:  boolean;
}

export function CharacterPicker({
  language,
  selectedId,
  onSelect,
  disabled = false,
}: CharacterPickerProps) {
  const characters = charactersForLanguage(language);

  return (
    <div className="w-full max-w-md flex flex-col items-center gap-3">
      <p className="text-[var(--text-secondary)] text-sm font-medium">
        Who do you want to talk with?
      </p>

      <div className="w-full grid gap-2 sm:grid-cols-3">
        {characters.map((char) => {
          const isActive = selectedId === char.id;
          return (
            <button
              key={char.id}
              type="button"
              onClick={() => !disabled && onSelect(char.id)}
              disabled={disabled}
              aria-pressed={isActive}
              className={`
                relative flex items-center gap-3 sm:flex-col sm:text-center
                px-3 py-2.5 rounded-xl border text-left
                transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed
                ${isActive
                  ? "border-[var(--accent-border-focus)] bg-[var(--accent-10)]"
                  : "border-[var(--border)] bg-[var(--bg-elevated)] hover:border-[var(--accent-border)]"
                }
              `}
            >
              <img
                src={char.avatarSrc}
                alt={char.name}
                className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover flex-shrink-0"
              />
              <div className="flex-1 min-w-0 sm:flex-none">
                <p className={`text-xs font-semibold truncate ${isActive ? "text-[var(--accent-text)]" : "text-[var(--text-secondary)]"}`}>
                  {char.name}
                </p>
                <p className="text-[10px] text-[var(--text-dim)] truncate sm:whitespace-normal sm:line-clamp-2">
                  {char.description}
                </p>
              </div>
              {isActive && (
                <div className="w-4 h-4 rounded-full bg-[var(--accent)] flex items-center justify-center flex-shrink-0
                                sm:absolute sm:top-2 sm:right-2">
                  <Check size={10} strokeWidth={3} className="text-[var(--accent-fg)]" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      <p className="text-[10px] text-[var(--text-xdim)]">
        Fixed once you send the first message
      </p>
    </div>
  );
}
