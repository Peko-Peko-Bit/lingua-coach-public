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
  /** Character personality definition inserted into the system prompt */
  prompt: string;
  /**
   * Restrict to specific languages when set (omit = all languages)
   * e.g. ["es"] shows the character only when Spanish is selected
   */
  compatibleLanguages?: LanguageCode[];
}

export const CHARACTERS: CharacterMeta[] = charactersData as CharacterMeta[];

export const DEFAULT_CHARACTER_ID = CHARACTERS[0]?.id ?? "roberta";
