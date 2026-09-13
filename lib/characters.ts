/**
 * lib/characters.ts
 *
 * AI tutor character definitions. lib/characters.json is the single source of truth.
 *
 * To add a character:
 *   1. Append a CharacterMeta object to lib/characters.json
 *   2. Place the image at public/characters/{id}.png (or .svg)
 */

import type { LanguageCode } from "./languages";
import charactersData from "./characters.json";

export interface CharacterMeta {
  id: string;
  /** Name shown in the Settings UI */
  name: string;
  /** Path to the image under public/ */
  avatarSrc: string;
  /** Description shown in the Settings UI */
  description: string;
  /**
   * Character personality definition inserted into the system prompt.
   * Omit the key entirely for a "bare LLM" character that runs with no
   * system prompt at all (see the bareMode path in lib/ai/generate.ts).
   */
  prompt?: string;
  /**
   * Restrict to specific languages when set (omit = all languages)
   * e.g. ["es"] shows the character only when Spanish is selected
   */
  compatibleLanguages?: LanguageCode[];
}

export const CHARACTERS: CharacterMeta[] = charactersData as CharacterMeta[];

// Default to Roberta explicitly (not array-position based): the "ai" bare
// character sits first in the list but must not be the startup default.
export const DEFAULT_CHARACTER_ID =
  CHARACTERS.find((c) => c.id === "roberta")?.id ?? CHARACTERS[0]?.id ?? "roberta";

const DEFAULT_CHARACTER =
  CHARACTERS.find((c) => c.id === DEFAULT_CHARACTER_ID) ?? CHARACTERS[0];

/**
 * Resolve a stored character ID to its definition.
 *
 * A thread's `characterId` is null for threads created before the
 * per-thread character feature (and always null for grammar threads), so
 * null / unknown IDs fall back to the default character. Always returns a
 * definition, never undefined — callers render from it directly.
 */
export function resolveCharacter(characterId: string | null | undefined): CharacterMeta {
  if (!characterId) return DEFAULT_CHARACTER;
  return CHARACTERS.find((c) => c.id === characterId) ?? DEFAULT_CHARACTER;
}

/** True when the character has no language restriction, or allows this language */
function isCompatible(character: CharacterMeta, language: LanguageCode): boolean {
  return !character.compatibleLanguages || character.compatibleLanguages.includes(language);
}

/** Characters selectable for a language (see CharacterMeta.compatibleLanguages) */
export function charactersForLanguage(language: LanguageCode): CharacterMeta[] {
  return CHARACTERS.filter((c) => isCompatible(c, language));
}

/**
 * Keep a character ID only if it is valid for the language, else fall back to
 * the default. Used on language switch, where the new thread inherits the
 * previously selected character.
 */
export function resolveCharacterIdForLanguage(
  characterId: string | null | undefined,
  language: LanguageCode,
): string {
  const character = resolveCharacter(characterId);
  return isCompatible(character, language) ? character.id : DEFAULT_CHARACTER_ID;
}
